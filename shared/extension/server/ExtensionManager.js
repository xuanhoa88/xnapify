/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

import { createScopedContainer } from '@shared/container/scoped.js';
import { getTranslations } from '@shared/i18n/loader.js';
import { addNamespace, removeNamespace } from '@shared/i18n/utils.js';
import { createNativeRequire } from '@shared/utils/createNativeRequire.js';
import { getDataDir } from '@shared/utils/env.js';

import {
  BaseExtensionManager,
  EXTENSION_METADATA,
  SEQUENTIAL_SYNC,
} from '../utils/BaseExtensionManager.js';
import {
  checkHostCompatibility,
  getGrantedCapabilities,
  incompatibleExtensionError,
  satisfiesRange,
} from '../utils/compat.js';
import { isDeferrableExtension } from '../utils/deferral.js';
import { normalizeRouteAdapter } from '../utils/routeAdapter.js';

import { registry } from './Registry.js';

// Use native require to load extension modules
const nativeRequire = createNativeRequire(import.meta.url);

// Symbols — private (internal to server manager)
const EXTENSION_API_ENTRY_POINTS = Symbol('__xnapify.ext.apiEntryPoints__');
const EXTENSION_CSS_ENTRY_POINTS = Symbol('__xnapify.ext.cssEntryPoints__');
const EXTENSION_SCRIPT_ENTRY_POINTS = Symbol(
  '__xnapify.ext.scriptEntryPoints__',
);
const SERVER_CWD = Symbol('__xnapify.ext.serverCwd__');

/** HTTP method exports a route module may define */
const ROUTE_METHOD_KEYS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
];

/**
 * Wrap a route handler so that, while it runs, `req.app.get('container')`
 * returns the extension's capability-scoped container. Middlewares that
 * precede the handler (auth, validation) keep the full container because
 * they are core code.
 *
 * @param {Function} handler
 * @param {() => Object} getScopedContainer
 * @returns {Function}
 */
function scopeRouteHandler(handler, getScopedContainer) {
  return function scopedHandler(req, res, next) {
    const scoped = getScopedContainer();
    const originalApp = req.app;
    const appProxy = new Proxy(originalApp, {
      get(target, prop) {
        if (prop === 'get') {
          return (...args) =>
            args.length === 1 && args[0] === 'container'
              ? scoped
              : target.get(...args);
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    req.app = appProxy;
    req.container = scoped;
    const restore = () => {
      req.app = originalApp;
    };

    try {
      const result = handler(req, res, next);
      if (result && typeof result.then === 'function') {
        return result.finally(restore);
      }
      restore();
      return result;
    } catch (error) {
      restore();
      throw error;
    }
  };
}

/**
 * Return a copy of a route module whose handlers are scoped.
 * @param {Object|Function} routeModule
 * @param {() => Object} getScopedContainer
 * @returns {Object|Function}
 */
export function scopeRouteModule(routeModule, getScopedContainer) {
  if (typeof routeModule === 'function') {
    return scopeRouteHandler(routeModule, getScopedContainer);
  }
  if (!routeModule || typeof routeModule !== 'object') return routeModule;

  const scopeExport = value => {
    if (Array.isArray(value)) {
      if (value.length === 0) return value;
      const last = value[value.length - 1];
      return typeof last === 'function'
        ? [...value.slice(0, -1), scopeRouteHandler(last, getScopedContainer)]
        : value;
    }
    return typeof value === 'function'
      ? scopeRouteHandler(value, getScopedContainer)
      : value;
  };

  const copy = {};
  for (const key of Object.keys(routeModule)) {
    const lower = key.toLowerCase();
    copy[key] =
      ROUTE_METHOD_KEYS.includes(lower) || key === 'default'
        ? scopeExport(routeModule[key])
        : routeModule[key];
  }
  return copy;
}

/** Non-throwing async file existence check */
async function fileExists(...filePaths) {
  try {
    await fs.promises.access(path.join(...filePaths));
    return true;
  } catch {
    return false;
  }
}

class ServerExtensionManager extends BaseExtensionManager {
  // ---------------------------------------------------------------------------
  // 1. Constructor
  // ---------------------------------------------------------------------------

  constructor() {
    super(registry);

    // Override sync() behavior in base class to prevent SQLite WAL locking issues
    this[SEQUENTIAL_SYNC] = true;
    this[EXTENSION_API_ENTRY_POINTS] = new Map();
    this[EXTENSION_CSS_ENTRY_POINTS] = new Map();
    this[EXTENSION_SCRIPT_ENTRY_POINTS] = new Map();

    // eslint-disable-next-line no-underscore-dangle
    this.on('extension:loaded', ({ id }) => this._onExtensionLoaded(id));

    // eslint-disable-next-line no-underscore-dangle
    this.on('extension:unloaded', ({ id }) => this._onExtensionUnloaded(id));

    // eslint-disable-next-line no-underscore-dangle
    this.on('manager:destroyed', () => this._onDestroy());
  }

  // ---------------------------------------------------------------------------
  // 2. Subclass Hooks
  // ---------------------------------------------------------------------------

  /**
   * Resolve view context for lifecycle hooks.
   * Returns the API DI container.
   *
   * @returns {import('@shared/container/index.js').Container}
   */
  _hookContext() {
    return this.apiContainer;
  }

  /**
   * Capability-scoped container for one extension.
   * Only the bindings declared under `xnapify.capabilities` resolve.
   *
   * @param {string} id - Extension ID
   * @param {Object} [manifest] - Manifest (defaults to loaded metadata)
   * @returns {Object} Scoped container
   */
  _extensionContainer(id, manifest = null) {
    const meta = this[EXTENSION_METADATA].get(id);
    const effective = manifest || (meta && meta.manifest) || {};
    return createScopedContainer(
      this.apiContainer,
      getGrantedCapabilities(effective),
      { owner: this._formatDisplayName(id, effective) },
    );
  }

  /**
   * View lifecycle context: the scoped API container.
   * @param {string} id - Extension ID
   * @returns {{ container: Object }}
   */
  _hookContextFor(id) {
    // eslint-disable-next-line no-underscore-dangle
    return { container: this._extensionContainer(id) };
  }

  /**
   * Enforce the host version contract before any bundle is required.
   * @param {string} id
   * @param {Object} manifest
   */
  _assertLoadable(id, manifest) {
    const result =
      manifest && manifest.compatibility
        ? manifest.compatibility
        : checkHostCompatibility(manifest);
    if (!result.ok) {
      throw incompatibleExtensionError(
        this._formatDisplayName(id, manifest),
        result,
      );
    }
  }

  _satisfiesRange(version, range) {
    return satisfiesRange(version, range);
  }

  /**
   * Server-side view activation lasts for the lifetime of the extension.
   *
   * The client activates plugin namespaces per route and tears them down on
   * navigation. Doing the same on the server would mutate one shared
   * registry from concurrent SSR requests, so extensions are booted once at
   * load (see `_postLoad`) and only ever unregistered by `unloadExtension`.
   *
   * @param {string} _ns - Namespace (ignored)
   */
  async deactivateViewNamespace(_ns) {}

  /**
   * Resolve the extension entry point based on manifest
   * @param {Object} manifest - Extension manifest
   * @returns {string|null} Entry point filename or null
   */
  _resolveEntryPoint(manifest) {
    // The manifest's entry points now contain content-hashed filenames
    // (e.g. './server.a1b2c3d4.js') from the stats.json.
    if (manifest && manifest.browser) {
      // The server loads the SSR bundle (server.js), resolved via buildManifest
      const bm = manifest.buildManifest;
      return (bm && bm['server.js']) || 'server.js';
    }
    if (manifest && manifest.main) {
      // API-only extension — use the main entry point directly
      return path.basename(manifest.main);
    }
    return null;
  }

  /**
   * Handle extension loaded event — activate via public API + store asset URLs.
   * Uses activateExtension() for validation, events, and error handling.
   */
  async _onExtensionLoaded(id) {
    const metadata = this[EXTENSION_METADATA].get(id);
    const manifest = metadata && metadata.manifest;

    // Tell the browser whether this extension contributes routes. Slot-only
    // extensions can be fetched lazily when one of their namespaces
    // activates; route providers must load before hydration.
    if (manifest && typeof manifest === 'object') {
      manifest.hasRoutes = metadata.hasRoutes === true;
    }

    // Activate via public API (validation → events → _performActivate)
    await this.activateExtension(id, manifest);

    // Store CSS/Script asset URLs for SSR injection
    // Uses content-hashed filenames from buildManifest for cache busting
    try {
      const bm = (manifest && manifest.buildManifest) || {};

      if (manifest && manifest.hasClientCss) {
        const cssFile = bm['extension.css'] || 'extension.css';
        this[EXTENSION_CSS_ENTRY_POINTS].set(
          id,
          this.getExtensionAssetUrl(id, cssFile),
        );
      }
      if (manifest && manifest.hasClientScript) {
        const scriptFile = bm['remote.js'] || 'remote.js';
        this[EXTENSION_SCRIPT_ENTRY_POINTS].set(
          id,
          this.getExtensionAssetUrl(id, scriptFile),
        );
      }
    } catch (err) {
      console.error(
        `[ServerExtensionManager] Failed to store asset URLs for ${this._formatDisplayName(id)}:`,
        err,
      );
      this.emit('extension:error', { id, error: err, phase: 'script-setup' });
    }
  }

  /**
   * Handle extension unloaded event — deactivate via public API + view cleanup.
   * Uses deactivateExtension() for validation, events, and error handling.
   */
  async _onExtensionUnloaded(id) {
    // Deactivate via public API (validation → events → _performDeactivate)
    await this.deactivateExtension(id);

    // View-specific cleanup
    this[EXTENSION_CSS_ENTRY_POINTS].delete(id);
    this[EXTENSION_SCRIPT_ENTRY_POINTS].delete(id);
  }

  /**
   * Server-specific cleanup during destroy().
   * Clears all server maps and routers.
   */
  _onDestroy() {
    this[EXTENSION_API_ENTRY_POINTS].clear();
    this[EXTENSION_CSS_ENTRY_POINTS].clear();
    this[EXTENSION_SCRIPT_ENTRY_POINTS].clear();
    this.routes.reset();
  }

  // ---------------------------------------------------------------------------
  // 3. Module Loading
  // ---------------------------------------------------------------------------

  /**
   * Load a module using non-bundled require
   * @param {string} bundlePath - Absolute path to the bundle
   * @returns {Object} Module exports
   */
  _requireModule(bundlePath) {
    // Delete require cache to ensure we get the latest version
    try {
      const resolvedPath = nativeRequire.resolve(bundlePath);
      delete nativeRequire.cache[resolvedPath];
    } catch {
      delete nativeRequire.cache[bundlePath];
    }

    try {
      return nativeRequire(bundlePath);
    } catch (error) {
      console.error(
        `[ServerExtensionManager] Failed to load module "${bundlePath}":`,
        error,
      );
      return null;
    }
  }

  /**
   * Resolve and require an extension's API module from disk.
   *
   * @param {Object} manifest - Extension manifest (needs .name and .main)
   * @returns {Promise<Object|null>} The API module exports, or null
   * @private
   */
  async _requireApiModule(manifest) {
    if (!manifest || !manifest.main || !manifest.id) return null;

    // manifest.main now contains the hashed filename (e.g. './api.a1b2c3d4.js')
    const apiFilename = path.basename(manifest.main);

    // eslint-disable-next-line no-underscore-dangle
    const bundlePath = await this._getExtensionBundlePath(
      manifest.name,
      apiFilename,
    );
    if (!bundlePath) return null;

    // eslint-disable-next-line no-underscore-dangle
    const apiModule = this._requireModule(bundlePath);
    if (!apiModule) return null;
    return apiModule.default || apiModule;
  }

  /**
   * Load the SSR view bundle and run view lifecycle phases.
   *
   * View lifecycle: translations → providers → routes
   * Mirrors the views autoloader pattern (shared/renderer/autoloader.js).
   *
   * @param {string} id - Extension ID
   * @param {Object} manifest - Extension manifest
   * @returns {Object|null} Extension module exports or null
   * @private
   */
  async _loadViewModule(id, manifest) {
    try {
      if (!manifest || !manifest.browser || !manifest.id) return null;

      // Resolve server bundle filename from buildManifest
      const bm = manifest.buildManifest || {};
      const serverFilename = bm['server.js'] || 'server.js';

      // eslint-disable-next-line no-underscore-dangle
      const bundlePath = await this._getExtensionBundlePath(
        manifest.name,
        serverFilename,
      );
      if (!bundlePath) {
        if (__DEV__) {
          console.warn(
            `[ServerExtensionManager] No view bundle path resolved for ${this._formatDisplayName(id)} (name=${manifest.name}, browser=${manifest.browser})`,
          );
        }
        return null;
      }
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Loading view module for ${this._formatDisplayName(id)} from ${bundlePath}`,
        );
      }

      // eslint-disable-next-line no-underscore-dangle
      const viewModule = this._requireModule(bundlePath);
      if (!viewModule) return null;
      const extensionView = viewModule.default || viewModule;

      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Loaded view module for ${this._formatDisplayName(id)}`,
        );
      }

      return extensionView;
    } catch (err) {
      console.error(
        `[ServerExtensionManager] Failed to load view module for ${this._formatDisplayName(id)}:`,
        err.message,
      );
      this.emit('extension:error', {
        id,
        error: err,
        phase: 'view-module',
      });
      return null;
    }
  }

  /**
   * Load extension module (server uses require, not MF containers).
   * Loads the SSR view module for registry registration.
   * API module loading is handled separately by the extension service
   * (activate/deactivate flow).
   *
   * @param {string} id - Extension ID
   * @param {string|null} _entryPoint - Resolved entry point filename
   * @param {Object} manifest - Extension manifest
   * @returns {Promise<Object|null>} View module or null (API-only extensions)
   */
  async _loadExtensionModule(id, _entryPoint, manifest) {
    try {
      // Load SSR view module (server.js — generated from browser entry)
      // eslint-disable-next-line no-underscore-dangle
      const viewModule = await this._loadViewModule(id, manifest);

      if (viewModule && __DEV__) {
        const version = (manifest && manifest.version) || '1.0.0';
        console.log(
          `[ServerExtensionManager] Loaded view for ${this._formatDisplayName(id)} v${version}`,
        );
      }

      // Always return a non-null object so the base class emits
      // 'extension:loaded' and triggers _onExtensionLoaded → activateExtension.
      // Without this, API-only or view-failed extensions would never activate.
      return viewModule || { boot() {} };
    } catch (error) {
      console.error(
        `[ServerExtensionManager] Failed to load view module for ${this._formatDisplayName(id)}:`,
        error.message,
      );
      this.emit('extension:error', {
        id,
        error,
        phase: 'load-module',
      });
    }

    // Even on error, return a minimal object so the extension lifecycle
    // continues and API routes can still be registered.
    return { boot() {} };
  }

  // ---------------------------------------------------------------------------
  // 4. Install / Uninstall
  // ---------------------------------------------------------------------------

  /**
   * Server-specific install: loads the API module from disk and
   * runs the install() lifecycle hook.
   *
   * @param {string} id - Extension ID
   * @param {Object} manifest - Extension manifest
   * @returns {Promise<boolean>}
   * @protected
   */
  async _performInstall(id, manifest) {
    // eslint-disable-next-line no-underscore-dangle
    const apiModule = await this._requireApiModule(manifest);
    if (!apiModule || typeof apiModule.install !== 'function') {
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] ${this._formatDisplayName(id)} has no install hook. Skipping.`,
        );
      }
      return true;
    }

    if (__DEV__) {
      console.log(
        `[ServerExtensionManager] Running install for ${this._formatDisplayName(id)} (v${manifest.version || '1.0.0'})`,
      );
    }

    await apiModule.install({
      // eslint-disable-next-line no-underscore-dangle
      container: this._extensionContainer(id, manifest),
      // eslint-disable-next-line no-underscore-dangle
      registry: this._scopedRegistry(id),
    });

    console.log(
      `[ServerExtensionManager] install completed for ${this._formatDisplayName(id)}`,
    );
    return true;
  }

  /**
   * Server-specific uninstall: auto-reverts seeds and migrations from
   * declarative contexts, then runs the uninstall() lifecycle hook.
   *
   * @param {string} id - Extension ID
   * @param {Object} manifest - Extension manifest
   * @returns {Promise<boolean>}
   * @protected
   */
  async _performUninstall(id, manifest) {
    // Load module once — reused for both revert and uninstall hook
    // eslint-disable-next-line no-underscore-dangle
    const apiModule = await this._requireApiModule(manifest);
    if (!apiModule) return true;

    // Auto-revert seeds and migrations from declarative contexts
    if (this.apiContainer) {
      try {
        const db = this.apiContainer.resolve('db');
        // eslint-disable-next-line no-underscore-dangle
        const scoped = this._extensionContainer(id, manifest);
        // Revert seeds first (data before schema)
        if (typeof apiModule.seeds === 'function') {
          const seedCtx = apiModule.seeds();
          if (seedCtx) {
            await db.connection.revertSeeds(
              [{ context: seedCtx, prefix: manifest.name }],
              { container: scoped },
            );
          }
        }

        // Revert migrations
        if (typeof apiModule.migrations === 'function') {
          const migrationCtx = apiModule.migrations();
          if (migrationCtx) {
            await db.connection.revertMigrations([
              { context: migrationCtx, prefix: manifest.name },
            ]);
          }
        }
      } catch (revertErr) {
        console.error(
          `[ServerExtensionManager] Auto-revert failed for ${this._formatDisplayName(id)}:`,
          revertErr.message,
        );
      }
    }

    // Run extension's custom uninstall() hook (if any)
    if (typeof apiModule.uninstall === 'function') {
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Running uninstall for ${this._formatDisplayName(id)} (v${manifest.version || '1.0.0'})`,
        );
      }

      await apiModule.uninstall({
        // eslint-disable-next-line no-underscore-dangle
        container: this._extensionContainer(id, manifest),
        // eslint-disable-next-line no-underscore-dangle
        registry: this._scopedRegistry(id),
      });

      console.log(
        `[ServerExtensionManager] uninstall completed for ${this._formatDisplayName(id)}`,
      );
    } else if (__DEV__) {
      console.log(
        `[ServerExtensionManager] ${this._formatDisplayName(id)} has no uninstall hook. Skipping.`,
      );
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // 5. Activate / Deactivate
  // ---------------------------------------------------------------------------

  /**
   * Load and boot the extension's API module.
   * Runs the full API lifecycle:
   *   translations → providers → migrations → models → seeds → boot → routes
   *
   * @param {string} id - Extension ID
   * @param {Object} manifest - Extension manifest
   * @returns {Promise<boolean>}
   * @protected
   */
  async _performActivate(id, manifest) {
    // eslint-disable-next-line no-underscore-dangle
    const extensionApi = await this._requireApiModule(manifest);
    if (!extensionApi) return false;

    // Store entry point for later shutdown
    this[EXTENSION_API_ENTRY_POINTS].set(id, extensionApi);

    try {
      const db = this.apiContainer.resolve('db');
      // Extensions only ever see the bindings they declared
      // eslint-disable-next-line no-underscore-dangle
      const scoped = this._extensionContainer(id, manifest);
      // eslint-disable-next-line no-underscore-dangle
      const registry = this._scopedRegistry(id);

      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Booting API for ${this._formatDisplayName(id)}`,
        );
      }

      // 1. Translations — register i18n namespaces
      if (typeof extensionApi.translations === 'function') {
        const result = extensionApi.translations();
        if (result) {
          const [translationContext, customNs] = Array.isArray(result)
            ? result
            : [result];
          if (translationContext) {
            const translations = getTranslations(translationContext);
            if (translations && Object.keys(translations).length > 0) {
              const namespace = customNs || `extension:${id}`;
              addNamespace(namespace, translations);

              // Track for teardown in _performDeactivate
              const meta = this[EXTENSION_METADATA].get(id);
              if (meta) meta.translationNamespace = namespace;
            }
          }
        }
      }

      // 2. Providers — bind DI services
      if (typeof extensionApi.providers === 'function') {
        await extensionApi.providers({ container: scoped, registry });
      }

      // 3. Migrations (idempotent — skips already-applied)
      if (db && typeof extensionApi.migrations === 'function') {
        const migrationCtx = extensionApi.migrations();
        if (migrationCtx) {
          await db.connection.runMigrations(
            [{ context: migrationCtx, prefix: manifest.name }],
            { container: scoped },
          );
        }
      }

      // 4. Models — register into global ModelRegistry
      if (db && typeof extensionApi.models === 'function') {
        const modelCtx = extensionApi.models();
        if (modelCtx) {
          const models = this.apiContainer.resolve('models');
          if (models && typeof models.discover === 'function') {
            await models.discover(modelCtx, id);
            await models.associate();
          }
        }
      }

      // 5. Seeds (idempotent — skips already-applied)
      if (db && typeof extensionApi.seeds === 'function') {
        const seedCtx = extensionApi.seeds();
        if (seedCtx) {
          await db.connection.runSeeds(
            [{ context: seedCtx, prefix: manifest.name }],
            { container: scoped },
          );
        }
      }

      // 6. Extension boot() hook
      if (typeof extensionApi.boot === 'function') {
        await extensionApi.boot({ container: scoped, registry });
      }

      // 7. API Routes
      if (typeof extensionApi.routes === 'function') {
        const routesObj = await extensionApi.routes();
        // eslint-disable-next-line no-underscore-dangle
        await this._injectRoutes(id, routesObj, 'api');
      }
    } catch (bootErr) {
      console.error(
        `[ServerExtensionManager] Activate failed for ${this._formatDisplayName(id)}:`,
        bootErr.message,
      );
      this.emit('extension:error', {
        id,
        error: bootErr,
        phase: 'api-activate',
      });
      return false;
    }

    return true;
  }

  /**
   * Shut down the extension's API module and clean up.
   * Runs shutdown hook, removes API routes, unregisters models.
   *
   * @param {string} id - Extension ID
   * @returns {Promise<boolean>}
   * @protected
   */
  async _performDeactivate(id) {
    try {
      // Run shutdown hook
      const apiEntry = this[EXTENSION_API_ENTRY_POINTS].get(id);
      if (apiEntry && typeof apiEntry.shutdown === 'function') {
        await apiEntry.shutdown({
          // eslint-disable-next-line no-underscore-dangle
          container: this._extensionContainer(id),
          // eslint-disable-next-line no-underscore-dangle
          registry: this._scopedRegistry(id),
        });
        if (__DEV__) {
          console.log(
            `[ServerExtensionManager] Shut down API for: ${this._formatDisplayName(id)}`,
          );
        }
      }

      // Unregister extension models
      try {
        const models = this.apiContainer.resolve('models');
        if (typeof models.unregister === 'function') {
          models.unregister(id);
        }
      } catch {
        // non-fatal
      }

      // Remove API-side translations
      const meta = this[EXTENSION_METADATA].get(id);
      removeNamespace((meta && meta.translationNamespace) || `extension:${id}`);

      // Clean up API entry point
      this[EXTENSION_API_ENTRY_POINTS].delete(id);
    } catch (err) {
      console.error(
        `[ServerExtensionManager] Deactivate failed for ${this._formatDisplayName(id)}:`,
        err.message,
      );
      this.emit('extension:error', {
        id,
        error: err,
        phase: 'api-deactivate',
      });
      return false;
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // 6. Route Management
  // ---------------------------------------------------------------------------

  /**
   * Inject (or buffer) routes for an extension.
   * @param {string} id - Extension ID
   * @param {*} hookResult - Return value of the extension's routes() hook
   * @param {'api'|'views'} type - External route type (for normalizeRouteAdapter)
   */
  _injectRoutes(id, hookResult, type) {
    const routerKey = type === 'api' ? 'api' : 'views';
    const router = this.routes.routerFor(routerKey);
    let adapter = normalizeRouteAdapter(hookResult, type);

    // API handlers of module-type extensions run under the same capability
    // scope as their lifecycle hooks.
    if (type === 'api') {
      const base = adapter;
      // eslint-disable-next-line no-underscore-dangle
      const getScoped = () => this._extensionContainer(id);
      adapter = {
        ...base,
        files: () => base.files(),
        load: p => scopeRouteModule(base.load(p), getScoped),
        ...(typeof base.resolve === 'function' && {
          resolve: p => base.resolve(p),
        }),
      };
    }

    if (!router) {
      // Router not available yet — hold it until the router connects
      this.routes.buffer(id, adapter, routerKey);
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Buffered ${type} route(s) for ${this._formatDisplayName(id)} (router not ready)`,
        );
      }
      return;
    }

    const added = router.add(adapter);

    this.routes.store(id, adapter, routerKey);

    if (__DEV__) {
      console.log(
        `[ServerExtensionManager] Injected ${added.length} ${type} route(s) for ${this._formatDisplayName(id)}`,
      );
    }
  }

  /**
   * Connect the API router instance.
   * Called once at boot after the API DynamicRouter is created.
   *
   * @param {Object} apiRouter - API router with add/remove methods
   */
  connectApiRouter(apiRouter) {
    // eslint-disable-next-line no-underscore-dangle
    super._connectRouter('api', apiRouter);
    if (__DEV__) {
      console.log('[ServerExtensionManager] API router connected');
    }
  }

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 8. Refresh
  // ---------------------------------------------------------------------------

  /**
   * Targeted refresh: unload + reload specific extensions.
   * Each reload calls `GET /api/extensions/:id` for a fresh manifest.
   *
   * @param {string[]} extensionIds - Extension names or IDs
   * @protected
   */
  async _refreshExtensions(extensionIds) {
    // Build lookup map: name/id → internal id
    const metadataByKey = new Map();
    for (const [id, metadata] of this[EXTENSION_METADATA].entries()) {
      metadataByKey.set(id, id);
      const manifestName = metadata.manifest && metadata.manifest.name;
      if (manifestName && !metadataByKey.has(manifestName)) {
        metadataByKey.set(manifestName, id);
      }
    }

    // Resolve + deduplicate
    const resolvedIds = [
      ...new Set(
        extensionIds.map(name => metadataByKey.get(name)).filter(Boolean),
      ),
    ];

    if (resolvedIds.length === 0) {
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] refresh: no matching extensions for ${extensionIds.join(', ')}`,
        );
      }
      return;
    }

    if (__DEV__) {
      console.log(
        `[ServerExtensionManager] Refreshing: ${resolvedIds.map(id => this._formatDisplayName(id)).join(', ')}`,
      );
    }

    await this.emit('extensions:refreshing', { extensionIds: resolvedIds });

    // Unload all targeted extensions in parallel
    await Promise.allSettled(
      resolvedIds.map(async id => {
        await this.unloadExtension(id);
        this[EXTENSION_METADATA].delete(id);
      }),
    );

    // Reload sequentially — prevents concurrent SQLite writes
    for (const id of resolvedIds) {
      try {
        await this.loadExtension(id);
      } catch (err) {
        console.warn(
          `[ServerExtensionManager] Failed to reload extension "${this._formatDisplayName(id)}":`,
          err.message,
        );
      }
    }

    await this.emit('extensions:refreshed', { extensionIds: resolvedIds });

    if (__DEV__) {
      console.log('[ServerExtensionManager] Refreshed ✅');
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Filesystem & Paths
  // ---------------------------------------------------------------------------

  /**
   * Get the remote/installed extension path
   * @returns {string} Absolute extension path
   */
  getInstalledExtensionsDir() {
    try {
      return process.env.XNAPIFY_EXTENSION_DIR
        ? path.resolve(process.env.XNAPIFY_EXTENSION_DIR)
        : getDataDir('extensions');
    } catch (err) {
      console.error(`Failed to get extension path:`, err);
      return null;
    }
  }

  /**
   * Get the local/dev extension path
   * @param {string} cwd - Current working directory
   * @returns {string} Absolute dev extension path
   */
  getDevExtensionsDir(cwd = process.cwd()) {
    try {
      return path.resolve(
        cwd,
        process.env.XNAPIFY_EXTENSION_LOCAL_PATH || 'extensions',
      );
    } catch (err) {
      console.error(`Failed to get dev extension path for ${cwd}:`, err);
      return null;
    }
  }

  /**
   * Set the dev extensions directory
   * @param {string} cwd - Current working directory
   */
  setDevExtensionsDir(cwd) {
    this[SERVER_CWD] = cwd;
  }

  /**
   * Resolve the physical directory of an extension on disk.
   * Checks local/dev path first (dev override), then installed/remote path.
   *
   * Supports both flat (my-ext/) and scoped (@org/name/) layouts.
   * For scoped names, uses path.join which correctly handles the nested structure.
   *
   * This is the single source of truth for extension path resolution — used
   * internally by `_getExtensionBundlePath` and externally by the service layer
   *
   * @param {string} extensionKey - Extension directory name / key (e.g. '@xnapify-extension/quick-access')
   * @returns {{ dir: string|null, isDevExtension: boolean }}
   */
  async resolveExtensionDir(extensionKey) {
    if (!extensionKey) return { dir: null, isDevExtension: false };

    try {
      // 1. Check dev/local dir (SERVER_CWD/extensions/)
      if (this[SERVER_CWD]) {
        const devBaseDir = this.getDevExtensionsDir(this[SERVER_CWD]);
        if (devBaseDir) {
          const devDir = path.join(devBaseDir, extensionKey);
          if (await fileExists(devDir)) {
            return {
              dir: devDir,
              isDevExtension: true,
            };
          }
        }
      }

      // 2. Check installed dir (~/.xnapify/extensions/)
      const baseDir = this.getInstalledExtensionsDir();
      if (baseDir) {
        const installedDir = path.join(baseDir, extensionKey);
        if (await fileExists(installedDir)) {
          return { dir: installedDir, isDevExtension: false };
        }
      }

      // 3. Fallback: check build/extensions/ relative to project root.
      //    In development the server bundle may live in .cache/dev/ (via
      //    BUILD_DIR override) while extensions are built to build/extensions/.
      //    This fallback bridges the gap without requiring a full rebuild.
      const fallbackDir = path.resolve(
        process.cwd(),
        'build',
        'extensions',
        extensionKey,
      );
      if (await fileExists(fallbackDir)) {
        return { dir: fallbackDir, isDevExtension: true };
      }
    } catch (err) {
      console.error(
        `[ServerExtensionManager] Failed to resolve extension dir for ${extensionKey}:`,
        err,
      );
    }

    return { dir: null, isDevExtension: false };
  }

  /**
   * Derive the canonical extension ID from a manifest.
   * The ID is generated at build time via `generateExtensionId(name)` and
   * written into the output package.json. This method simply reads it.
   *
   * @param {Object} manifest - Extension manifest (package.json)
   * @returns {string|null}
   */
  _resolveExtensionId(manifest) {
    if (manifest && manifest.id) return manifest.id;
    return null;
  }

  /**
   * Read an extension's package.json manifest from its directory on disk.
   * Trusts the `manifest.id` field written at build time by the extension
   * build pipeline. Loads the sibling `stats.json` for
   * content-hashed filename resolution.
   * Detects built client assets from the build manifest.
   * @param {...string} extensionDirs - Absolute path to the extension directory
   * @returns {Object|null} Parsed manifest or null on failure
   */
  async readManifest(...extensionDirs) {
    try {
      const extDir = path.join(...extensionDirs);
      const manifestContent = await fs.promises.readFile(
        path.join(extDir, 'package.json'),
        'utf8',
      );
      const manifest = JSON.parse(manifestContent);

      // Trust id from built manifest. Fall back to _resolveExtensionId()
      // for unbuilt source extensions that lack a pre-generated id.
      if (!manifest.id) {
        // eslint-disable-next-line no-underscore-dangle
        manifest.id = this._resolveExtensionId(manifest);
      }

      // Load stats.json for content-hashed filename resolution
      let buildManifest = null;
      try {
        const bmContent = await fs.promises.readFile(
          path.join(extDir, 'stats.json'),
          'utf8',
        );
        buildManifest = JSON.parse(bmContent);
      } catch {
        // No build manifest — extension may not be built yet (dev source)
      }
      manifest.buildManifest = buildManifest;

      // Host version contract — evaluated once here, enforced in _assertLoadable
      manifest.compatibility = checkHostCompatibility(manifest);

      // Detect built client assets from build manifest
      if (buildManifest) {
        manifest.hasClientCss = !!buildManifest['extension.css'];
        manifest.hasClientScript = !!buildManifest['remote.js'];
      } else {
        // Fallback: detect by file existence (for unbuilt dev extensions)
        if (await fileExists(extDir, 'extension.css')) {
          manifest.hasClientCss = true;
        }
        if (await fileExists(extDir, 'remote.js')) {
          manifest.hasClientScript = true;
        }
      }

      return manifest;
    } catch {
      return null;
    }
  }

  /**
   * Get the path to an extension's bundle file.
   * Delegates to `resolveExtensionDir` for dev/prod path resolution.
   *
   * @param {string} extensionDir - Extension directory name
   * @param {string} filename - Bundle filename
   * @returns {string|null} Absolute path to the bundle file
   */
  async _getExtensionBundlePath(extensionDir, filename) {
    const { dir } = await this.resolveExtensionDir(extensionDir);
    return dir ? path.join(dir, filename) : null;
  }

  // ---------------------------------------------------------------------------
  // 9. SSR Accessors
  // ---------------------------------------------------------------------------

  /**
   * Get all extension CSS entries for SSR injection
   * @returns {Array<{href: string, id: string}>}
   */
  get cssUrls() {
    const entries = [];
    for (const [id, href] of this[EXTENSION_CSS_ENTRY_POINTS]) {
      if (this.isExtensionDeferred(id)) continue;
      entries.push({ href, id });
    }
    return entries;
  }

  /**
   * Whether an extension's assets are fetched lazily by the browser (when
   * one of its namespaces activates) instead of being emitted in every page.
   * The client manager injects the stylesheet itself on load.
   *
   * @param {string} id - Extension ID
   * @returns {boolean}
   */
  isExtensionDeferred(id) {
    const metadata = this[EXTENSION_METADATA].get(id);
    return isDeferrableExtension(metadata && metadata.manifest);
  }

  /**
   * Get all extension script entries for SSR injection
   * @returns {Array<{src: string, id: string}>}
   */
  get scriptUrls() {
    const entries = [];
    for (const [id, src] of this[EXTENSION_SCRIPT_ENTRY_POINTS]) {
      if (this.isExtensionDeferred(id)) continue;
      entries.push({ src, id });
    }
    return entries;
  }
}

// Export singleton instance
const extensionManager = new ServerExtensionManager();

export default extensionManager;
