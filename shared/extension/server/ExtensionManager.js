/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { normalizeRouteAdapter } from '@shared/utils/routeAdapter';

import {
  BaseExtensionManager,
  ACTIVE_EXTENSIONS,
  EXTENSION_CONTEXT,
  LOADED_VERSIONS,
  EXTENSION_INIT,
  EXTENSION_METADATA,
} from '../utils/BaseExtensionManager';

// Symbols for internal state
const EXTENSION_API_ENTRY_POINTS = Symbol('__rsk.extensionApiEntryPoints__');
const EXTENSION_CSS_ENTRY_POINTS = Symbol('__rsk.extensionCssEntryPoints__');
const EXTENSION_SCRIPT_ENTRY_POINTS = Symbol(
  '__rsk.extensionScriptEntryPoints__',
);
const EXTENSION_ROUTE_ADAPTERS = Symbol('__rsk.extensionRouteAdapters__');
const PENDING_ROUTE_INJECTIONS = Symbol('__rsk.pendingRouteInjections__');

class ServerExtensionManager extends BaseExtensionManager {
  constructor() {
    super();
    this[EXTENSION_API_ENTRY_POINTS] = new Map();
    this[EXTENSION_CSS_ENTRY_POINTS] = new Map();
    this[EXTENSION_SCRIPT_ENTRY_POINTS] = new Map();
    this[EXTENSION_ROUTE_ADAPTERS] = new Map();
    this[PENDING_ROUTE_INJECTIONS] = [];

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
        await apiEntry.destroy(this.registry, this[EXTENSION_CONTEXT]);
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
    this[EXTENSION_ROUTE_ADAPTERS].delete(id);
  }

  _onManagerDestroyed() {
    this[EXTENSION_API_ENTRY_POINTS].clear();
    this[EXTENSION_CSS_ENTRY_POINTS].clear();
    this[EXTENSION_SCRIPT_ENTRY_POINTS].clear();
    this[EXTENSION_ROUTE_ADAPTERS].clear();
  }

  // ---------------------------------------------------------------------------
  // Container & route helpers
  // ---------------------------------------------------------------------------

  _resolveFromContainer(key) {
    const ctx = this[EXTENSION_CONTEXT];
    try {
      return ctx.container.resolve(key);
    } catch {
      return null;
    }
  }

  _injectRoutes(id, hookResult, type) {
    const routerKey = type === 'api' ? 'apiRouter' : 'viewRouter';
    // eslint-disable-next-line no-underscore-dangle
    const router = this._resolveFromContainer(routerKey);
    const adapter = normalizeRouteAdapter(hookResult, type);

    if (!router) {
      // Router not available yet — buffer for later injection
      this[PENDING_ROUTE_INJECTIONS].push({ id, adapter, type });
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Buffered ${type} route(s) for ${id} (router not ready)`,
        );
      }
      return;
    }

    const added = router.add(adapter);

    if (!this[EXTENSION_ROUTE_ADAPTERS].has(id)) {
      this[EXTENSION_ROUTE_ADAPTERS].set(id, {});
    }
    const adapterKey = type === 'api' ? 'api' : 'view';
    this[EXTENSION_ROUTE_ADAPTERS].get(id)[adapterKey] = adapter;

    if (__DEV__) {
      console.log(
        `[ServerExtensionManager] Injected ${added.length} ${type} route(s) for ${id}`,
      );
    }
  }

  /**
   * Inject extension route adapters into the current router.
   *
   * Handles two cases:
   * 1. Pending injections buffered during init (router wasn't ready yet)
   * 2. Already-stored adapters that need re-injection when a new router
   *    is created (SSR creates a new router per request, but init runs once)
   *
   * Called by views bootstrap after the router is created and registered.
   *
   * @param {Object} [viewRouter] - The current view router instance.
   *   When provided, bypasses container resolution (avoids stale context on
   *   subsequent SSR requests where init() returns early without updating
   *   the container reference).
   */
  flushPendingRoutes(viewRouter) {
    // 1. Process pending injections first (buffer → store)
    const pending = this[PENDING_ROUTE_INJECTIONS].splice(0);
    for (const { id, adapter, type } of pending) {
      if (!this[EXTENSION_ROUTE_ADAPTERS].has(id)) {
        this[EXTENSION_ROUTE_ADAPTERS].set(id, {});
      }
      const adapterKey = type === 'api' ? 'api' : 'view';
      this[EXTENSION_ROUTE_ADAPTERS].get(id)[adapterKey] = adapter;
    }

    // 2. Resolve routers
    // eslint-disable-next-line no-underscore-dangle
    const vRouter = viewRouter || this._resolveFromContainer('viewRouter');
    // eslint-disable-next-line no-underscore-dangle
    const aRouter = this._resolveFromContainer('apiRouter');

    // 3. Inject all stored adapters into their respective routers
    for (const [id, adapters] of this[EXTENSION_ROUTE_ADAPTERS].entries()) {
      if (adapters.view && vRouter) {
        const added = vRouter.add(adapters.view);
        if (__DEV__) {
          console.log(
            `[ServerExtensionManager] Injected ${added.length} view route(s) for ${id}`,
          );
        }
      }

      if (adapters.api && aRouter) {
        const added = aRouter.add(adapters.api);
        if (__DEV__) {
          console.log(
            `[ServerExtensionManager] Injected ${added.length} API route(s) for ${id}`,
          );
        }
      }
    }

    if (!vRouter && __DEV__) {
      console.warn('[ServerExtensionManager] viewRouter unavailable for flush');
    }
  }

  _removeRouteAdapters(id) {
    const adapters = this[EXTENSION_ROUTE_ADAPTERS].get(id);
    if (!adapters) return;

    if (adapters.api) {
      // eslint-disable-next-line no-underscore-dangle
      const apiRouter = this._resolveFromContainer('apiRouter');
      if (apiRouter) apiRouter.remove(adapters.api);
    }
    if (adapters.view) {
      // eslint-disable-next-line no-underscore-dangle
      const viewRouter = this._resolveFromContainer('viewRouter');
      if (viewRouter) viewRouter.remove(adapters.view);
    }

    console.log(`[ServerExtensionManager] Removed route adapters for: ${id}`);
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
      if (this[EXTENSION_CONTEXT] && this[EXTENSION_CONTEXT].cwd) {
        const devBaseDir = this.getDevExtensionPath(
          this[EXTENSION_CONTEXT].cwd,
        );
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
   * Validate server environment and context
   * @throws {Error} If context is invalid
   */
  _validateServerContext() {
    if (
      typeof this[EXTENSION_CONTEXT].cwd !== 'string' ||
      this[EXTENSION_CONTEXT].cwd.trim().length === 0
    ) {
      if (__DEV__) {
        console.warn(
          '[ServerExtensionManager] Running without explicit cwd, using process.cwd()',
        );
      }
      this[EXTENSION_CONTEXT].cwd = process.cwd();
    }
  }

  /**
   * Ensure server extension manager is ready
   * For SSR: Ensures context is valid before loading extensions
   * @returns {Promise<void>}
   */
  async _ensureReady() {
    if (this[EXTENSION_INIT]) {
      return this[EXTENSION_INIT];
    }

    this[EXTENSION_INIT] = (async () => {
      // Validate server context
      // eslint-disable-next-line no-underscore-dangle
      this._validateServerContext();

      if (__DEV__) {
        console.log('[ServerExtensionManager] Server extension manager ready');
      }
    })();

    return this[EXTENSION_INIT];
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
  resolveEntryPoint(manifest) {
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
    // eslint-disable-next-line no-underscore-dangle
    await this._ensureReady();

    const apiModule = this.requireModule(apiBundlePath);
    const extensionApi = apiModule.default || apiModule;

    if (extensionApi && typeof extensionApi[hookName] === 'function') {
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Running ${hookName} for ${id} (v${manifest.version || '0.0.0'})`,
        );
      }
      await extensionApi[hookName](this.registry, this[EXTENSION_CONTEXT]);
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
   * Load the extension module from the SSR bundle and inject view routes.
   * On the server, `server.js` is the full extension definition (init, destroy,
   * views, slots, hooks) built from the browser entry point.
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

    try {
      const apiModule = this.requireModule(apiBundlePath);
      const extensionApi = apiModule.default || apiModule;

      // Call init() lifecycle hook
      if (extensionApi && typeof extensionApi.init === 'function') {
        if (__DEV__) {
          console.log(`[ServerExtensionManager] Booting API for ${id}`);
        }
        // eslint-disable-next-line no-underscore-dangle
        await extensionApi.init(this.registry, this[EXTENSION_CONTEXT]);
        this[EXTENSION_API_ENTRY_POINTS].set(id, extensionApi);
      } else {
        console.warn(
          `[ServerExtensionManager] Extension ${id} has no init() in API module`,
        );
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
    } catch (err) {
      console.error(
        `[ServerExtensionManager] Failed to boot API for ${id}:`,
        err.message,
      );
      this.emit('extension:error', { id, error: err, phase: 'api-boot' });
    }
  }

  /**
   * Load extension module (server uses require, not MF containers).
   * Orchestrates view module loading, API booting, and route injection.
   *
   * @param {string} id - Extension ID
   * @param {string|null} entryPoint - Resolved entry point filename
   * @param {Object} manifest - Extension manifest
   * @returns {Promise<Object|null>} Extension module or null
   */
  async _bootstrapExtension(id, entryPoint, manifest, _options) {
    if (!entryPoint) {
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Skipping ${id} (no server entry point)`,
        );
      }
      return null;
    }

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

    // eslint-disable-next-line no-underscore-dangle
    await this._ensureReady();
    const startTime = Date.now();

    try {
      // 1. Load extension module (if browser entry exists)
      // eslint-disable-next-line no-underscore-dangle
      const viewModule = this._loadViewModule(id, manifest);

      // 2. Load API module (init + routes)
      // eslint-disable-next-line no-underscore-dangle
      await this._loadApiModule(id, manifest);

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

      // Return view module, or synthetic object for API-only extensions
      if (viewModule) return viewModule;
      if (entryPoint === 'api.js') {
        return { name: id, version: currentVersion, register: () => [] };
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
   * does a complete syncExtensions().
   *
   * @param  {...string} extensionIds - Extension names/IDs to refresh (empty = all)
   * @returns {Promise<void>}
   */
  async refresh(...extensionIds) {
    if (!this[EXTENSION_CONTEXT]) {
      if (__DEV__) {
        console.log('[ServerExtensionManager] Skipping refresh (no context)');
      }
      return;
    }

    // Full refresh: delegate to base class (re-fetches everything)
    if (extensionIds.length === 0) {
      return super.refresh();
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
    const resolvedEntries = extensionIds
      .map(name => metadataByKey.get(name))
      .filter(Boolean)
      .map(({ id, metadata }) => {
        const extensionKey =
          (metadata.manifest && metadata.manifest.name) || id;
        const { dir } = this.resolveExtensionDir(extensionKey);

        let freshManifest = dir ? this.readManifest(dir) : null;
        if (!freshManifest) {
          freshManifest = metadata.manifest;
        } else {
          try {
            if (fs.existsSync(path.join(dir, 'extension.css'))) {
              freshManifest.hasClientCss = true;
            }
            if (fs.existsSync(path.join(dir, 'remote.js'))) {
              freshManifest.hasClientScript = true;
            }
          } catch {
            // Non-critical: asset detection failure
          }
        }

        return { id, manifest: { ...freshManifest, fromDisk: true } };
      });

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
   * Subscribe to events (No-op on server)
   */
  onReady() {
    // No WebSocket subscriptions on server
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
