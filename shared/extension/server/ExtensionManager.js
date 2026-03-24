/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  BaseExtensionManager,
  ACTIVE_EXTENSIONS,
  LOADED_VERSIONS,
  EXTENSION_METADATA,
  BUFFERED_ROUTES,
  STORED_ADAPTERS,
} from '../utils/BaseExtensionManager';
import { normalizeRouteAdapter } from '../utils/routeAdapter';

// Symbols — private (internal to server manager)
const EXTENSION_API_ENTRY_POINTS = Symbol('__rsk.ext.apiEntryPoints__');
const EXTENSION_CSS_ENTRY_POINTS = Symbol('__rsk.ext.cssEntryPoints__');
const EXTENSION_SCRIPT_ENTRY_POINTS = Symbol('__rsk.ext.scriptEntryPoints__');
const CONNECTED_ROUTERS = Symbol('__rsk.ext.connectedRouters__');
const SERVER_CWD = Symbol('__rsk.ext.serverCwd__');
const SERVER_CONTAINER = Symbol('__rsk.ext.serverContainer__');

/** Non-throwing async file existence check */
async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

class ServerExtensionManager extends BaseExtensionManager {
  constructor() {
    super();
    this[EXTENSION_API_ENTRY_POINTS] = new Map();
    this[EXTENSION_CSS_ENTRY_POINTS] = new Map();
    this[EXTENSION_SCRIPT_ENTRY_POINTS] = new Map();
    this[STORED_ADAPTERS] = new Map();
    this[BUFFERED_ROUTES] = [];
    this[CONNECTED_ROUTERS] = { api: null, view: null };
    this[SERVER_CWD] = null;
    this[SERVER_CONTAINER] = null;

    // eslint-disable-next-line no-underscore-dangle
    this.on('extension:loaded', ({ id }) => this._onExtensionLoaded(id));
    // eslint-disable-next-line no-underscore-dangle
    this.on('extension:unloaded', ({ id }) => this._onExtensionUnloaded(id));
    // eslint-disable-next-line no-underscore-dangle
    this.on('manager:destroyed', () => this._onManagerDestroyed());
  }

  // ---------------------------------------------------------------------------
  // Lifecycle event handlers
  // ---------------------------------------------------------------------------

  async _onExtensionLoaded(id) {
    try {
      const metadata = this[EXTENSION_METADATA].get(id);
      const manifest = metadata && metadata.manifest;
      const version = (manifest && manifest.version) || '0.0.0';

      if (manifest && manifest.hasClientCss) {
        this[EXTENSION_CSS_ENTRY_POINTS].set(
          id,
          this.getExtensionAssetUrl(id, `extension.css?v=${version}`),
        );
      }
      if (manifest && manifest.hasClientScript) {
        this[EXTENSION_SCRIPT_ENTRY_POINTS].set(
          id,
          this.getExtensionAssetUrl(id, `remote.js?v=${version}`),
        );
      }
    } catch (err) {
      console.error(
        `[ServerExtensionManager] Failed to store asset URLs for ${id}:`,
        err,
      );
      this.emit('extension:error', { id, error: err, phase: 'script-setup' });
    }
  }

  async _onExtensionUnloaded(id) {
    // Destroy API instance
    try {
      const apiEntry = this[EXTENSION_API_ENTRY_POINTS].get(id);
      if (apiEntry && typeof apiEntry.destroy === 'function') {
        await apiEntry.destroy(this.registry, {
          container: this[SERVER_CONTAINER],
        });
        if (__DEV__) {
          console.log(`[ServerExtensionManager] Destroyed API for: ${id}`);
        }
      }
    } catch (err) {
      console.error(
        `[ServerExtensionManager] Failed to destroy API for ${id}:`,
        err,
      );
      this.emit('extension:error', { id, error: err, phase: 'api-destroy' });
    }

    // Remove injected route adapters from routers
    // eslint-disable-next-line no-underscore-dangle
    this._removeRouteAdapters(id);

    // Clean up maps
    this[EXTENSION_API_ENTRY_POINTS].delete(id);
    this[EXTENSION_CSS_ENTRY_POINTS].delete(id);
    this[EXTENSION_SCRIPT_ENTRY_POINTS].delete(id);
    this[STORED_ADAPTERS].delete(id);
  }

  _onManagerDestroyed() {
    this[EXTENSION_API_ENTRY_POINTS].clear();
    this[EXTENSION_CSS_ENTRY_POINTS].clear();
    this[EXTENSION_SCRIPT_ENTRY_POINTS].clear();
    this[STORED_ADAPTERS].clear();
    this[CONNECTED_ROUTERS] = { api: null, view: null };
    this[BUFFERED_ROUTES].length = 0;
    this[SERVER_CWD] = null;
    this[SERVER_CONTAINER] = null;
  }

  // ---------------------------------------------------------------------------
  // Route helpers
  // ---------------------------------------------------------------------------

  _injectRoutes(id, hookResult, type) {
    const routerKey = type === 'api' ? 'api' : 'view';
    const router = this[CONNECTED_ROUTERS][routerKey];
    const adapter = normalizeRouteAdapter(hookResult, type);

    if (!router) {
      // Router not available yet — buffer for later injection
      this[BUFFERED_ROUTES].push({ id, adapter, type });
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Buffered ${type} route(s) for ${id} (router not ready)`,
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
        `[ServerExtensionManager] Injected ${added.length} ${type} route(s) for ${id}`,
      );
    }
  }

  /**
   * Connect a router instance and flush pending/stored route adapters.
   *
   * Shared logic for both view and API routers:
   * 1. Drains pending injections matching `routerKey` from buffer → store
   * 2. Re-injects all stored adapters for `routerKey` into the router
   *
   * @param {string} routerKey - 'view' or 'api'
   * @param {Object} router - Router instance with add(adapter) method
   */
  _connectRouter(routerKey, router) {
    this[CONNECTED_ROUTERS][routerKey] = router;

    // 1. Drain pending injections for this router key (buffer → store)
    const remaining = [];
    for (const entry of this[BUFFERED_ROUTES]) {
      const entryKey = entry.type === 'api' ? 'api' : 'view';
      if (entryKey === routerKey) {
        if (!this[STORED_ADAPTERS].has(entry.id)) {
          this[STORED_ADAPTERS].set(entry.id, {});
        }
        this[STORED_ADAPTERS].get(entry.id)[routerKey] = entry.adapter;
      } else {
        remaining.push(entry);
      }
    }
    this[BUFFERED_ROUTES].length = 0;
    this[BUFFERED_ROUTES].push(...remaining);

    // 2. Inject all stored adapters for this router key
    for (const [id, adapters] of this[STORED_ADAPTERS].entries()) {
      if (adapters[routerKey] && router) {
        const added = router.add(adapters[routerKey]);
        if (__DEV__) {
          console.log(
            `[ServerExtensionManager] Injected ${added.length} ${routerKey} route(s) for ${id}`,
          );
        }
      }
    }
  }

  /**
   * Connect the view router instance.
   * Called per-request by views bootstrap (SSR creates a new router each time).
   *
   * @param {Object} viewRouter - View router with add/remove methods
   */
  connectViewRouter(viewRouter) {
    // eslint-disable-next-line no-underscore-dangle
    this._connectRouter('view', viewRouter);
  }

  /**
   * Connect the API router instance.
   * Called once at boot after the API DynamicRouter is created.
   *
   * @param {Object} apiRouter - API router with add/remove methods
   */
  connectApiRouter(apiRouter) {
    // eslint-disable-next-line no-underscore-dangle
    this._connectRouter('api', apiRouter);
  }

  _removeRouteAdapters(id) {
    const adapters = this[STORED_ADAPTERS].get(id);
    if (!adapters) return;

    if (adapters.api && this[CONNECTED_ROUTERS].api) {
      this[CONNECTED_ROUTERS].api.remove(adapters.api);
    }

    if (adapters.view && this[CONNECTED_ROUTERS].view) {
      this[CONNECTED_ROUTERS].view.remove(adapters.view);
    }

    this[STORED_ADAPTERS].delete(id);

    if (__DEV__) {
      console.log(`[ServerExtensionManager] Removed route adapters for: ${id}`);
    }
  }

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

  /**
   * Get the remote/installed extension path
   * @returns {string} Absolute extension path
   */
  getInstalledExtensionsDir() {
    try {
      return path.resolve(
        process.env.RSK_EXTENSION_DIR ||
          path.join(os.homedir(), '.rsk', 'extensions'),
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
  getDevExtensionPath(cwd = process.cwd()) {
    try {
      return path.resolve(
        cwd,
        process.env.RSK_EXTENSION_LOCAL_PATH || 'extensions',
      );
    } catch (err) {
      console.error(`Failed to get dev extension path for ${cwd}:`, err);
      return null;
    }
  }

  /**
   * Resolve the physical directory of an extension on disk.
   * Checks local/dev path first (dev override), then installed/remote path.
   *
   * This is the single source of truth for extension path resolution — used
   * internally by `_getExtensionBundlePath` and externally by the service layer
   * (via `extension.helpers.resolveExtensionDir`).
   *
   * @param {string} extensionKey - Extension directory name / key
   * @returns {{ dir: string|null, isDevExtension: boolean }}
   */
  resolveExtensionDir(extensionKey) {
    if (!extensionKey) return { dir: null, isDevExtension: false };

    const baseExtensionDir = extensionKey.split(path.sep)[0] || extensionKey;

    try {
      if (this[SERVER_CWD]) {
        const devBaseDir = this.getDevExtensionPath(this[SERVER_CWD]);
        if (
          devBaseDir &&
          fs.existsSync(path.join(devBaseDir, baseExtensionDir))
        ) {
          return {
            dir: path.join(devBaseDir, extensionKey),
            isDevExtension: true,
          };
        }
      }

      const baseDir = this.getInstalledExtensionsDir();
      if (baseDir && fs.existsSync(path.join(baseDir, baseExtensionDir))) {
        return { dir: path.join(baseDir, extensionKey), isDevExtension: false };
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
   * Read an extension's package.json manifest from its directory on disk.
   * @param {string} extensionDir - Absolute path to the extension directory
   * @returns {Object|null} Parsed manifest or null on failure
   */
  readManifest(extensionDir) {
    try {
      const manifestPath = path.join(extensionDir, 'package.json');
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
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
  _getExtensionBundlePath(extensionDir, filename) {
    const { dir } = this.resolveExtensionDir(extensionDir);
    return dir ? path.join(dir, filename) : null;
  }

  /**
   * Load a module using non-webpack require
   * @param {string} bundlePath - Absolute path to the bundle
   * @returns {Object} Module exports
   */
  requireModule(bundlePath) {
    // Use non-webpack require to load extensions from filesystem
    // eslint-disable-next-line no-undef
    const requireFunc =
      typeof __non_webpack_require__ === 'function'
        ? // eslint-disable-next-line no-undef
          __non_webpack_require__
        : require;

    // Delete require cache to ensure we get the latest version
    try {
      const resolvedPath = requireFunc.resolve(bundlePath);
      delete requireFunc.cache[resolvedPath];
    } catch {
      delete requireFunc.cache[bundlePath];
    }

    return requireFunc(bundlePath);
  }

  /**
   * Environment-specific setup called once by init().
   * Resolves `cwd` for bundle path resolution and stores the DI container
   * for use by lifecycle hooks (init, destroy, install, uninstall).
   * @param {Object} container - DI container
   */
  async _onInit(container) {
    // Store container for extension lifecycle hooks
    this[SERVER_CONTAINER] = container;

    // Store cwd for bundle path resolution
    try {
      const cwd = container.resolve('cwd');
      await fileExists(cwd);
      this[SERVER_CWD] = cwd;
    } catch {
      if (__DEV__) {
        console.warn(
          '[ServerExtensionManager] cwd not accessible, using process.cwd()',
        );
      }
      this[SERVER_CWD] = process.cwd();
    }

    if (__DEV__) {
      console.log('[ServerExtensionManager] Server extension manager ready');
    }
  }

  /**
   * Server has no persistent store at boot — SSR creates a per-request store
   * and activates namespaces via onRouteInit during rendering.
   * @returns {boolean}
   */
  // eslint-disable-next-line class-methods-use-this
  _shouldEagerActivate() {
    return false;
  }

  /**
   * Resolve the extension entry point based on manifest
   * @param {Object} manifest - Extension manifest
   * @returns {string|null} Entry point filename or null
   */
  _resolveEntryPoint(manifest) {
    // If browser exists, we have a View (server.js) generated from it
    if (manifest && manifest.browser) return 'server.js';
    if (manifest && manifest.main) return 'api.js';
    return null;
  }

  /**
   * Run a lifecycle hook from the extension's API module.
   * Loads the API bundle from disk and calls the named export.
   *
   * @param {string} id - Extension key
   * @param {string} hookName - Hook name (e.g. 'install', 'uninstall')
   * @param {Object} manifest - Extension manifest (must contain `name` and `main`)
   * @private
   */
  async _runLifecycleHook(id, hookName, manifest) {
    if (!manifest || !manifest.main) {
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Skipping ${hookName} for ${id} (no API entry)`,
        );
      }
      return;
    }

    if (!manifest.name) return;

    // eslint-disable-next-line no-underscore-dangle
    const apiBundlePath = this._getExtensionBundlePath(
      manifest.name,
      manifest.main,
    );

    const apiModule = this.requireModule(apiBundlePath);
    const extensionApi = apiModule.default || apiModule;

    if (extensionApi && typeof extensionApi[hookName] === 'function') {
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Running ${hookName} for ${id} (v${manifest.version || '0.0.0'})`,
        );
      }
      await extensionApi[hookName](this.registry, {
        container: this[SERVER_CONTAINER],
      });
      console.log(`[ServerExtensionManager] ${hookName} completed for ${id}`);
    } else if (__DEV__) {
      console.log(
        `[ServerExtensionManager] ${id} has no ${hookName} hook. Skipping.`,
      );
    }
  }

  /**
   * Execute a server-side lifecycle hook (install/uninstall) with event
   * emission and error handling.
   *
   * @param {string} id - Extension key
   * @param {string} hookName - 'install' or 'uninstall'
   * @param {Object} manifest - Extension manifest
   * @returns {Promise<boolean>}
   * @private
   */
  async _executeLifecycle(id, hookName, manifest) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Extension ID must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('extension:validation-failed', { id, error });
      console.error(error);
      return false;
    }

    await this.emit(`extension:${hookName}ing`, { id });

    try {
      // eslint-disable-next-line no-underscore-dangle
      await this._runLifecycleHook(id, hookName, manifest);
      await this.emit(`extension:${hookName}ed`, { id });
      return true;
    } catch (error) {
      console.error(
        `[ServerExtensionManager] Failed to ${hookName} extension "${id}":`,
        error,
      );
      await this.emit(`extension:${hookName}-failed`, { id, error });
      throw error;
    }
  }

  /**
   * Server-specific install: loads the API module from disk and runs
   * the install() lifecycle hook.
   */
  async installExtension(id, manifest) {
    // eslint-disable-next-line no-underscore-dangle
    return this._executeLifecycle(id, 'install', manifest);
  }

  /**
   * Server-specific uninstall: loads the API module from disk and runs
   * the uninstall() lifecycle hook.
   */
  async uninstallExtension(id, manifest) {
    // eslint-disable-next-line no-underscore-dangle
    return this._executeLifecycle(id, 'uninstall', manifest);
  }

  // ---------------------------------------------------------------------------
  // Module loading — split into focused helpers
  // ---------------------------------------------------------------------------

  /**
   * Load the SSR view bundle and inject view routes.
   * `server.js` is the SSR-compiled version of the browser entry, typically
   * exporting `{ views, translations }`. The full lifecycle hooks (init,
   * routes, install) come from the API module, not here.
   *
   * @param {string} id - Extension ID
   * @param {Object} manifest - Extension manifest
   * @returns {Object|null} Extension module exports or null
   * @private
   */
  _loadViewModule(id, manifest) {
    if (!manifest || !manifest.browser) return null;

    // eslint-disable-next-line no-underscore-dangle
    const bundlePath = this._getExtensionBundlePath(
      path.join(manifest.name, path.dirname(manifest.browser)),
      'server.js',
    );
    if (__DEV__) {
      console.log(
        `[ServerExtensionManager] Loading view module for ${id} from ${bundlePath}`,
      );
    }

    const viewModule = this.requireModule(bundlePath);
    const extensionModule = viewModule.default || viewModule;

    // Inject view routes if the extension provides a views() hook
    try {
      // eslint-disable-next-line no-underscore-dangle
      this._injectViewRoutes(id, extensionModule, manifest, 'views');
    } catch (err) {
      console.error(
        `[ServerExtensionManager] Failed to inject view routes for ${id}:`,
        err.message,
      );
      this.emit('extension:error', {
        id,
        error: err,
        phase: 'view-routes',
      });
    }

    return extensionModule;
  }

  /**
   * Load the API module, call init(), and inject API routes.
   *
   * Init and route injection are independent — if init() fails (e.g. because
   * runProviders hasn't been called yet), routes are still injected so the
   * API endpoints are reachable.
   *
   * @param {string} id - Extension ID
   * @param {Object} manifest - Extension manifest
   * @private
   */
  async _loadApiModule(id, manifest) {
    if (!manifest || !manifest.main) return;

    // eslint-disable-next-line no-underscore-dangle
    const apiBundlePath = this._getExtensionBundlePath(
      manifest.name,
      manifest.main,
    );

    let extensionApi;

    try {
      const apiModule = this.requireModule(apiBundlePath);
      extensionApi = apiModule.default || apiModule;
    } catch (err) {
      console.error(
        `[ServerExtensionManager] Failed to load API module for ${id}:`,
        err.message,
      );
      this.emit('extension:error', { id, error: err, phase: 'api-load' });
      return;
    }

    // Store entry point so destroy() can run later regardless of init() outcome
    this[EXTENSION_API_ENTRY_POINTS].set(id, extensionApi);

    // Call init() lifecycle hook (non-fatal — routes are injected regardless)
    if (extensionApi && typeof extensionApi.init === 'function') {
      try {
        if (__DEV__) {
          console.log(`[ServerExtensionManager] Booting API for ${id}`);
        }
        await extensionApi.init(this.registry, {
          container: this[SERVER_CONTAINER],
        });
      } catch (initErr) {
        console.error(
          `[ServerExtensionManager] init() failed for ${id}:`,
          initErr.message,
        );
        this.emit('extension:error', {
          id,
          error: initErr,
          phase: 'api-init',
        });
      }
    }

    // Inject API routes if the extension provides a routes() hook
    if (extensionApi && typeof extensionApi.routes === 'function') {
      try {
        // eslint-disable-next-line no-underscore-dangle
        this._injectRoutes(id, extensionApi.routes(), 'api');
      } catch (routeErr) {
        console.error(
          `[ServerExtensionManager] Failed to inject API routes for ${id}:`,
          routeErr.message,
        );
        this.emit('extension:error', {
          id,
          error: routeErr,
          phase: 'api-routes',
        });
      }
    }

    return extensionApi;
  }

  /**
   * Load extension module (server uses require, not MF containers).
   * Orchestrates view module loading, API booting, and route injection.
   *
   * @param {string} id - Extension ID
   * @param {string|null} _entryPoint - Resolved entry point filename
   * @param {Object} manifest - Extension manifest
   * @returns {Promise<Object|null>} Extension module or null
   */
  async _bootstrapExtension(id, _entryPoint, manifest) {
    const extensionDir = manifest && manifest.name;
    const currentVersion = (manifest && manifest.version) || '0.0.0';

    if (!extensionDir) {
      const error = new Error(
        `Extension name required for server-side extension loading: ${id}`,
      );
      error.code = 'EXTENSION_NAME_REQUIRED';
      error.extensionId = id;
      throw error;
    }

    const startTime = Date.now();

    try {
      // 1. Load SSR view module (server.js — generated from browser entry)
      // eslint-disable-next-line no-underscore-dangle
      const viewModule = this._loadViewModule(id, manifest);

      // 2. Load API module (init + routes)
      // eslint-disable-next-line no-underscore-dangle
      const apiModule = await this._loadApiModule(id, manifest);

      // Track version
      this[LOADED_VERSIONS].set(id, currentVersion);

      // Performance monitoring
      const loadTime = Date.now() - startTime;
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Loaded ${id} v${currentVersion} (${loadTime}ms)`,
        );
        if (loadTime > 500) {
          console.warn(
            `[ServerExtensionManager] Slow load: ${id} took ${loadTime}ms`,
          );
        }
      }

      // Merge view + API modules into a single extension object so
      // loadExtension → defineExtension gets the complete picture
      // (e.g. views from SSR bundle, init/routes from API bundle).
      if (viewModule || apiModule) {
        return { ...apiModule, ...viewModule };
      }
      return null;
    } catch (err) {
      const error = new Error(
        `Failed to load extension "${id}": ${err.message}`,
      );
      error.code = err.code || 'EXTENSION_LOAD_FAILED';
      error.extensionId = id;
      error.originalError = err;

      console.error(`[ServerExtensionManager] ${error.message}`, {
        extensionDir,
        extensionId: id,
        version: currentVersion,
        error: err.message,
        stack: __DEV__ ? err.stack : undefined,
      });

      throw error;
    }
  }

  /**
   * Server-side refresh override.
   *
   * For targeted refreshes (specific extension IDs), reads fresh manifests
   * directly from disk rather than going through the HTTP self-fetch cycle.
   * This ensures that newly rebuilt extension bundles are picked up immediately
   * during dev-mode HMR.
   *
   * For full refreshes (no specific IDs), delegates to the base class which
   * does a complete sync().
   *
   * @param  {...string} extensionIds - Extension names/IDs to refresh (empty = all)
   * @returns {Promise<void>}
   */
  async refresh(...extensionIds) {
    // Full refresh: re-sync from API, then discover dev disk extensions
    if (extensionIds.length === 0) {
      await super.refresh();

      // After API sync, scan dev extensions dir for disk-only extensions
      // not yet registered in the DB (true plug & play for dev)
      const devDir = this.getDevExtensionPath(this[SERVER_CWD]);
      if (devDir && fs.existsSync(devDir)) {
        try {
          const entries = fs.readdirSync(devDir, { withFileTypes: true });
          const loadedNames = new Set(
            Array.from(this[EXTENSION_METADATA].values())
              .map(m => m.manifest && m.manifest.name)
              .filter(Boolean),
          );

          const devExtensions = (
            await Promise.all(
              entries
                .filter(entry => entry.isDirectory())
                .map(async entry => {
                  const extDir = path.join(devDir, entry.name);
                  const manifest = this.readManifest(extDir);
                  if (!manifest || !manifest.name) return null;
                  if (loadedNames.has(manifest.name)) return null;

                  if (await fileExists(path.join(extDir, 'extension.css'))) {
                    manifest.hasClientCss = true;
                  }
                  if (await fileExists(path.join(extDir, 'remote.js'))) {
                    manifest.hasClientScript = true;
                  }

                  return { ...manifest, fromDisk: true };
                }),
            )
          ).filter(Boolean);

          if (devExtensions.length > 0) {
            if (__DEV__) {
              console.log(
                `[ServerExtensionManager] Discovered dev extensions: ${devExtensions.map(m => m.name).join(', ')}`,
              );
            }
            await Promise.allSettled(
              devExtensions.map(manifest =>
                this.loadExtension(manifest.name, manifest),
              ),
            );
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

      return;
    }

    // Build lookup map once: name/id → { id, metadata }  (O(M))
    const metadataByKey = new Map();
    for (const [id, metadata] of this[EXTENSION_METADATA].entries()) {
      metadataByKey.set(id, { id, metadata });
      const manifestName = metadata.manifest && metadata.manifest.name;
      if (manifestName && !metadataByKey.has(manifestName)) {
        metadataByKey.set(manifestName, { id, metadata });
      }
    }

    // Resolve each name in O(1)
    const resolvedEntries = (
      await Promise.all(
        extensionIds
          .map(name => metadataByKey.get(name))
          .filter(Boolean)
          .map(async ({ id, metadata }) => {
            const extensionKey =
              (metadata.manifest && metadata.manifest.name) || id;
            const { dir } = this.resolveExtensionDir(extensionKey);

            let freshManifest = dir ? this.readManifest(dir) : null;
            if (!freshManifest) {
              freshManifest = metadata.manifest;
            } else {
              if (await fileExists(path.join(dir, 'extension.css'))) {
                freshManifest.hasClientCss = true;
              }
              if (await fileExists(path.join(dir, 'remote.js'))) {
                freshManifest.hasClientScript = true;
              }
            }

            return { id, manifest: { ...freshManifest, fromDisk: true } };
          }),
      )
    ).filter(Boolean);

    if (resolvedEntries.length === 0) {
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] refresh: no matching extensions found for ${extensionIds.join(', ')}`,
        );
      }
      return;
    }

    if (__DEV__) {
      console.log(
        `[ServerExtensionManager] Refreshing: ${resolvedEntries.map(e => e.id).join(', ')}`,
      );
    }

    await this.emit('extensions:refreshing', {
      extensionIds: resolvedEntries.map(e => e.id),
    });

    // Unload all extensions in parallel (they're independent)
    await Promise.all(
      resolvedEntries.map(async ({ id }) => {
        if (this[ACTIVE_EXTENSIONS].has(id)) {
          await this.unloadExtension(id);
        }
        this[EXTENSION_METADATA].delete(id);
      }),
    );

    // Reload all extensions in parallel with fresh disk manifests
    await Promise.all(
      resolvedEntries.map(({ id, manifest }) =>
        this.loadExtension(id, manifest),
      ),
    );

    await this.emit('extensions:refreshed', {
      extensionIds: resolvedEntries.map(e => e.id),
    });

    if (__DEV__) {
      console.log('[ServerExtensionManager] Refreshed ✅');
    }
  }

  /**
   * Handle external event (No-op on server - server doesn't receive WebSocket events)
   * @param {Object} _event - Event object (unused)
   */
  async onWebSocketEvent(_event) {
    // Server-side event handling is not supported
    // Extensions are loaded at initialization and reloaded on server restart
    if (__DEV__) {
      console.warn(
        '[ServerExtensionManager] onWebSocketEvent called on server - this is a no-op',
      );
    }
  }
}

// Export singleton instance
const extensionManager = new ServerExtensionManager();

export default extensionManager;
