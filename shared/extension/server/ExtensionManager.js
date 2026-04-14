/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { getTranslations } from '@shared/i18n/loader';
import { addNamespace, removeNamespace } from '@shared/i18n/utils';
import { createNativeRequire } from '@shared/utils/createNativeRequire';

import {
  BaseExtensionManager,
  ExtensionState,
  EXTENSION_METADATA,
  BUFFERED_ROUTES,
  STORED_ADAPTERS,
  CONNECTED_ROUTERS,
} from '../utils/BaseExtensionManager';
import { normalizeRouteAdapter } from '../utils/routeAdapter';

import { registry } from './Registry';

// Use native require to load extension modules
const nativeRequire = createNativeRequire(__filename);

// Symbols — private (internal to server manager)
const EXTENSION_API_ENTRY_POINTS = Symbol('__xnapify.ext.apiEntryPoints__');
const EXTENSION_CSS_ENTRY_POINTS = Symbol('__xnapify.ext.cssEntryPoints__');
const EXTENSION_SCRIPT_ENTRY_POINTS = Symbol(
  '__xnapify.ext.scriptEntryPoints__',
);
const SERVER_CWD = Symbol('__xnapify.ext.serverCwd__');

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
    this[EXTENSION_API_ENTRY_POINTS] = new Map();
    this[EXTENSION_CSS_ENTRY_POINTS] = new Map();
    this[EXTENSION_SCRIPT_ENTRY_POINTS] = new Map();

    // eslint-disable-next-line no-underscore-dangle
    this.on('extension:loaded', ({ id }) => this._onExtensionLoaded(id));

    // eslint-disable-next-line no-underscore-dangle
    this.on('extension:unloaded', ({ id }) => this._onExtensionUnloaded(id));

    // Discover dev extensions after full refresh (extensionIds: null)
    this.on('extensions:refreshed', ({ extensionIds }) => {
      // eslint-disable-next-line no-underscore-dangle
      if (extensionIds === null) this._discoverDevExtensions();
    });

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
   * @returns {import('@shared/container').Container}
   */
  _hookContext() {
    return this.apiContainer;
  }

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
    this[STORED_ADAPTERS].clear();
    this[CONNECTED_ROUTERS] = { api: null, view: null };
    this[BUFFERED_ROUTES].length = 0;
  }

  // ---------------------------------------------------------------------------
  // 3. Module Loading
  // ---------------------------------------------------------------------------

  /**
   * Load a module using non-webpack require
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
        const version = (manifest && manifest.version) || '0.0.0';
        console.log(
          `[ServerExtensionManager] Loaded view for ${this._formatDisplayName(id)} v${version}`,
        );
      }

      // Always return a non-null object so the base class emits
      // 'extension:loaded' and triggers _onExtensionLoaded → activateExtension.
      // Without this, API-only or view-failed extensions would never activate.
      return viewModule || { setup() {} };
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
    return { setup() {} };
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
        `[ServerExtensionManager] Running install for ${this._formatDisplayName(id)} (v${manifest.version || '0.0.0'})`,
      );
    }

    await apiModule.install({
      container: this.apiContainer,
      registry: this.registry,
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
        // Revert seeds first (data before schema)
        if (typeof apiModule.seeds === 'function') {
          const seedCtx = apiModule.seeds();
          if (seedCtx) {
            await db.connection.revertSeeds(
              [{ context: seedCtx, prefix: manifest.name }],
              { container: this.apiContainer },
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
          `[ServerExtensionManager] Running uninstall for ${this._formatDisplayName(id)} (v${manifest.version || '0.0.0'})`,
        );
      }

      await apiModule.uninstall({
        container: this.apiContainer,
        registry: this.registry,
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

      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Booting API for ${this._formatDisplayName(id)}`,
        );
      }

      // 1. Translations — register i18n namespaces
      if (typeof extensionApi.translations === 'function') {
        const translationContext = extensionApi.translations();
        if (translationContext) {
          const translations = getTranslations(translationContext);
          if (translations && Object.keys(translations).length > 0) {
            addNamespace(id, translations);
          }
        }
      }

      // 2. Providers — bind DI services
      if (typeof extensionApi.providers === 'function') {
        await extensionApi.providers({
          container: this.apiContainer,
          registry: this.registry,
        });
      }

      // 3. Migrations (idempotent — skips already-applied)
      if (db && typeof extensionApi.migrations === 'function') {
        const migrationCtx = extensionApi.migrations();
        if (migrationCtx) {
          await db.connection.runMigrations([
            { context: migrationCtx, prefix: manifest.name },
          ]);
        }
      }

      // 4. Models — register into global ModelRegistry
      if (db && typeof extensionApi.models === 'function') {
        const modelCtx = extensionApi.models();
        if (modelCtx) {
          const models = this.apiContainer.resolve('models');
          if (models && typeof models.discover === 'function') {
            await models.discover(modelCtx, id);
            models.associate();
          }
        }
      }

      // 5. Seeds (idempotent — skips already-applied)
      if (db && typeof extensionApi.seeds === 'function') {
        const seedCtx = extensionApi.seeds();
        if (seedCtx) {
          await db.connection.runSeeds(
            [{ context: seedCtx, prefix: manifest.name }],
            { container: this.apiContainer },
          );
        }
      }

      // 6. Extension boot() hook
      if (typeof extensionApi.boot === 'function') {
        await extensionApi.boot({
          container: this.apiContainer,
          registry: this.registry,
        });
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
          container: this.apiContainer,
          registry: this.registry,
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
      removeNamespace(id);

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
    const router = this[CONNECTED_ROUTERS][routerKey];
    const adapter = normalizeRouteAdapter(hookResult, type);

    if (!router) {
      // Router not available yet — buffer with internal routerKey
      this[BUFFERED_ROUTES].push({ id, adapter, type: routerKey });
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Buffered ${type} route(s) for ${this._formatDisplayName(id)} (router not ready)`,
        );
      }
      return;
    }

    const added = router.add(adapter);

    if (!this[STORED_ADAPTERS].has(id)) {
      this[STORED_ADAPTERS].set(id, {});
    }
    this[STORED_ADAPTERS].get(id)[routerKey] = adapter;

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
  // 7. Sync (serialized — prevents SQLITE_BUSY)
  // ---------------------------------------------------------------------------

  /**
   * Override base sync() to serialize extension loading.
   * SQLite only supports a single writer — loading extensions in parallel
   * (via Promise.allSettled in the base class) causes SQLITE_BUSY when
   * multiple extensions run migrations/seeds concurrently.
   *
   * The client-side base class keeps parallel loading (no SQLite concern).
   */
  async sync() {
    try {
      const { data: response } = await this.fetch('/api/extensions');
      const extensions =
        response && Array.isArray(response.extensions)
          ? response.extensions
          : [];

      let loaded = 0;
      let failed = 0;

      // Sequential loading prevents concurrent SQLite writes
      for (const item of extensions) {
        const id = typeof item === 'object' ? item.id : item;
        const manifest = typeof item === 'object' ? item : null;
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.loadExtension(id, manifest);

          // loadExtension catches errors internally and returns undefined
          // (does not re-throw), so check metadata state for accurate count
          const meta = this[EXTENSION_METADATA].get(id);
          if (meta && meta.state === ExtensionState.FAILED) {
            failed++;
          } else {
            loaded++;
          }
        } catch (err) {
          failed++;
          console.warn(
            `[ServerExtensionManager] Failed to load extension "${this._formatDisplayName(id)}":`,
            err.message,
          );
        }
      }

      await this.emit('extensions:initialized', {
        total: extensions.length,
        loaded,
        failed,
      });
    } catch (error) {
      console.error('[ExtensionManager] Failed to fetch extensions:', error);
      await this.emit('extensions:init-failed', { error });
    }
  }

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
        // eslint-disable-next-line no-await-in-loop
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

  /**
   * Scan the dev extensions directory for extensions not yet in the DB.
   * Uses async I/O throughout. Called after full refresh to enable
   * "plug & play" development without DB registration.
   *
   * @private
   */
  async _discoverDevExtensions() {
    try {
      const devBaseDir = this.getDevExtensionsDir(this[SERVER_CWD]);
      if (!devBaseDir || !(await fileExists(devBaseDir))) return;

      const entries = await fs.promises.readdir(devBaseDir, {
        withFileTypes: true,
      });

      const loadedNames = new Set(
        Array.from(this[EXTENSION_METADATA].values())
          .map(m => m.manifest && m.manifest.name)
          .filter(Boolean),
      );

      const extDirs = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('@')) {
          const scopeDir = path.join(devBaseDir, entry.name);
          try {
            const scopeEntries = await fs.promises.readdir(scopeDir, {
              withFileTypes: true,
            });
            for (const subEntry of scopeEntries) {
              if (subEntry.isDirectory()) {
                extDirs.push(path.join(scopeDir, subEntry.name));
              }
            }
          } catch {
            // skip
          }
        } else {
          extDirs.push(path.join(devBaseDir, entry.name));
        }
      }

      const devExtensions = (
        await Promise.all(
          extDirs.map(async extDir => {
            const manifest = await this.readManifest(extDir);
            if (!manifest || !manifest.id) return null;
            if (loadedNames.has(manifest.name)) return null;

            return { ...manifest, fromDisk: true };
          }),
        )
      ).filter(Boolean);

      if (devExtensions.length > 0) {
        if (__DEV__) {
          console.log(
            `[ServerExtensionManager] Discovered dev extensions: ${devExtensions.map(m => this._formatDisplayName(m.id)).join(', ')}`,
          );
        }
        // Sequential loading — prevents concurrent SQLite writes
        for (const manifest of devExtensions) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await this.loadExtension(manifest.id, manifest);
          } catch (err) {
            console.warn(
              `[ServerExtensionManager] Failed to load dev extension "${this._formatDisplayName(manifest.id)}":`,
              err.message,
            );
          }
        }
      }
    } catch (err) {
      if (__DEV__) {
        console.warn(
          '[ServerExtensionManager] Dev extension scan failed:',
          err.message,
        );
      }
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
      return path.resolve(
        process.env.XNAPIFY_EXTENSION_DIR ||
          path.join(
            process.env.NODE_ENV === 'production'
              ? os.homedir()
              : process.cwd(),
            '.xnapify',
            'extensions',
          ),
      );
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
      // 1. Check dev/local dir
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

      // 2. Check installed dir
      const baseDir = this.getInstalledExtensionsDir();
      if (baseDir) {
        const installedDir = path.join(baseDir, extensionKey);
        if (await fileExists(installedDir)) {
          return { dir: installedDir, isDevExtension: false };
        }
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
   * Install an extension from an in-memory package buffer (tarball/zip).
   *
   * Filesystem-only operation:
   *  1. Write buffer to a temp file
   *  2. Extract into a temp directory
   *  3. Locate and validate package.json
   *  4. Move to the installed extensions directory
   *  5. Load the extension into the manager
   *
   * Does NOT interact with the database — the caller (e.g. marketplace
   * engine) is responsible for creating/updating DB records.
   *
   * @param {Buffer} packageBuffer - Raw package contents
   * @returns {Promise<{ name: string, version: string, manifest: Object, dir: string }>}
   */
  async installFromBuffer(packageBuffer) {
    if (!Buffer.isBuffer(packageBuffer) || packageBuffer.length === 0) {
      const error = new Error('installFromBuffer requires a non-empty Buffer');
      error.code = 'INVALID_BUFFER';
      throw error;
    }

    const tempDir = path.join(
      os.tmpdir(),
      'xnapify-ext-install-' + Date.now().toString(36),
    );
    const tempFile = tempDir + '.pkg';

    try {
      // 1. Write buffer to temp file
      await fs.promises.writeFile(tempFile, packageBuffer);

      // 2. Extract
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Try tar.gz first, fall back to treating as zip via child_process
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      try {
        await execAsync(`tar -xzf "${tempFile}" -C "${tempDir}"`);
      } catch {
        // Fall back to unzip
        await execAsync(`unzip -o "${tempFile}" -d "${tempDir}"`);
      }

      // 3. Locate package.json (may be at root or one level deep)
      let extensionRoot = tempDir;
      let manifest = await this.readManifest(extensionRoot);

      if (!manifest) {
        // Deeply search for package.json through single subdirectories (handles scoped formats as well as package/)
        let currentDir = tempDir;
        let depth = 0;
        while (currentDir && depth < 5) {
          depth++;
          const entries = await fs.promises.readdir(currentDir, {
            withFileTypes: true,
          });
          const subdirs = entries.filter(d => d.isDirectory());
          if (subdirs.length === 1) {
            currentDir = path.join(currentDir, subdirs[0].name);
            manifest = await this.readManifest(currentDir);
            if (manifest) {
              extensionRoot = currentDir;
              break;
            }
          } else {
            break;
          }
        }
      }

      if (!manifest || !manifest.name) {
        const error = new Error(
          'Invalid extension package: package.json not found or missing "name"',
        );
        error.code = 'INVALID_PACKAGE';
        throw error;
      }

      const extensionName = manifest.name;
      const extensionVersion = manifest.version || '0.0.0';

      // 4. Security: prevent path traversal
      // Allow scoped names (exactly one '/' after '@'), block everything else
      const isScopedName =
        extensionName.startsWith('@') &&
        extensionName.indexOf('/') === extensionName.lastIndexOf('/') &&
        extensionName.indexOf('/') > 1;

      if (
        extensionName.includes('..') ||
        extensionName.includes('\\') ||
        (!isScopedName && extensionName.includes('/'))
      ) {
        const error = new Error(
          `Extension name "${extensionName}" contains invalid path characters`,
        );
        error.code = 'INVALID_EXTENSION_NAME';
        throw error;
      }

      // 5. Move to installed extensions directory
      const extensionsDir = this.getInstalledExtensionsDir();
      if (!extensionsDir) {
        const error = new Error(
          'Installed extensions directory not configured',
        );
        error.code = 'NO_EXTENSIONS_DIR';
        throw error;
      }

      await fs.promises.mkdir(extensionsDir, { recursive: true });
      const finalDir = path.join(extensionsDir, extensionName);

      // Remove existing version if present
      if (await fileExists(finalDir)) {
        await fs.promises.rm(finalDir, { recursive: true, force: true });
      }

      await fs.promises.rename(extensionRoot, finalDir);

      // 6. Load the extension
      await this.loadExtension(extensionName, manifest);

      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Installed from buffer: ${extensionName}@${extensionVersion}`,
        );
      }

      return {
        name: extensionName,
        version: extensionVersion,
        manifest,
        dir: finalDir,
      };
    } finally {
      // Cleanup temp files
      try {
        if (await fileExists(tempFile)) {
          await fs.promises.unlink(tempFile);
        }
        if (await fileExists(tempDir)) {
          await fs.promises.rm(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupErr) {
        if (__DEV__) {
          console.warn(
            '[ServerExtensionManager] installFromBuffer cleanup failed:',
            cleanupErr.message,
          );
        }
      }
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
      entries.push({ href, id });
    }
    return entries;
  }

  /**
   * Get all extension script entries for SSR injection
   * @returns {Array<{src: string, id: string}>}
   */
  get scriptUrls() {
    const entries = [];
    for (const [id, src] of this[EXTENSION_SCRIPT_ENTRY_POINTS]) {
      entries.push({ src, id });
    }
    return entries;
  }
}

// Export singleton instance
const extensionManager = new ServerExtensionManager();

export default extensionManager;
