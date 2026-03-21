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
  EXTENSION_CONTEXT,
  LOADED_VERSIONS,
  EXTENSION_MANAGER_INIT,
  EXTENSION_METADATA,
} from '../utils/BaseExtensionManager';

// Symbols for internal state
const EXTENSION_API_ENTRY_POINTS = Symbol('__rsk.extensionApiEntryPoints__');
const EXTENSION_CSS_ENTRY_POINTS = Symbol('__rsk.extensionCssEntryPoints__');
const EXTENSION_SCRIPT_ENTRY_POINTS = Symbol('__rsk.extensionScriptEntryPoints__');

class ServerExtensionManager extends BaseExtensionManager {
  constructor() {
    super();
    this[EXTENSION_API_ENTRY_POINTS] = new Map(); // id -> api instances
    this[EXTENSION_CSS_ENTRY_POINTS] = new Map(); // id -> css URL string
    this[EXTENSION_SCRIPT_ENTRY_POINTS] = new Map(); // id -> script URL string

    // Store CSS entry points when extension is loaded
    this.on('extension:loaded', async ({ id }) => {
      try {
        const metadata = this[EXTENSION_METADATA].get(id);
        const manifest = metadata && metadata.manifest;
        const currentVersion = (manifest && manifest.version) || '0.0.0';

        // Store CSS entry points when extension is loaded
        if (manifest && manifest.hasClientCss) {
          this[EXTENSION_CSS_ENTRY_POINTS].set(
            id,
            this.getExtensionAssetUrl(id, `extension.css?v=${currentVersion}`),
          );
        }

        // Store script entry points when extension is loaded
        // Include the browser MF container (remote.js) so it is SSR-injected
        if (manifest && manifest.hasClientScript) {
          this[EXTENSION_SCRIPT_ENTRY_POINTS].set(
            id,
            this.getExtensionAssetUrl(id, `remote.js?v=${currentVersion}`),
          );
        }
      } catch (err) {
        console.error(
          `[ExtensionManager] Failed to store CSS entry points for ${id}:`,
          err,
        );
        this.emit('extension:error', { id, error: err, phase: 'script-setup' });
      }
    });

    // Clean up API instances when extension is unloaded
    this.on('extension:unloaded', async ({ id }) => {
      try {
        const apiEntry = this[EXTENSION_API_ENTRY_POINTS].get(id);
        if (apiEntry && typeof apiEntry.destroy === 'function') {
          await apiEntry.destroy(this.registry, this[EXTENSION_CONTEXT]);
          if (__DEV__) {
            console.log(`[ExtensionManager] Destroyed API for: ${id}`);
          }
        }
      } catch (err) {
        console.error(`[ExtensionManager] Failed to destroy API for ${id}:`, err);
        this.emit('extension:error', { id, error: err, phase: 'api-destroy' });
      }
      this[EXTENSION_API_ENTRY_POINTS].delete(id);
      this[EXTENSION_CSS_ENTRY_POINTS].delete(id);
      this[EXTENSION_SCRIPT_ENTRY_POINTS].delete(id);
    });

    // Clear internal maps when manager is destroyed
    this.on('manager:destroyed', () => {
      this[EXTENSION_API_ENTRY_POINTS].clear();
      this[EXTENSION_CSS_ENTRY_POINTS].clear();
      this[EXTENSION_SCRIPT_ENTRY_POINTS].clear();
    });
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
  getExtensionPath() {
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
      return path.resolve(cwd, process.env.RSK_EXTENSION_LOCAL_PATH || 'extensions');
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
        const devBaseDir = this.getDevExtensionPath(this[EXTENSION_CONTEXT].cwd);
        if (devBaseDir && fs.existsSync(path.join(devBaseDir, baseExtensionDir))) {
          return { dir: path.join(devBaseDir, extensionKey), isDevExtension: true };
        }
      }

      const baseDir = this.getExtensionPath();
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
  // eslint-disable-next-line class-methods-use-this
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
  loadModule(bundlePath) {
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
    if (this[EXTENSION_MANAGER_INIT]) {
      return this[EXTENSION_MANAGER_INIT];
    }

    this[EXTENSION_MANAGER_INIT] = (async () => {
      // Validate server context
      // eslint-disable-next-line no-underscore-dangle
      this._validateServerContext();

      if (__DEV__) {
        console.log('[ServerExtensionManager] Server extension manager ready');
      }
    })();

    return this[EXTENSION_MANAGER_INIT];
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
   * Uses the provided manifest to resolve the API bundle path and calls the
   * named export.  The caller MUST supply the manifest — this method does NOT
   * perform any API fetch.
   *
   * @param {string} id - Extension key
   * @param {string} hookName - Name of the hook (e.g. 'install', 'uninstall')
   * @param {Object} manifest - Extension manifest (must contain `name` and `main`)
   * @returns {Promise<void>}
   * @private
   */
  async _runLifecycleHook(id, hookName, manifest) {
    if (!manifest || !manifest.main) {
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Skipping ${hookName} hook for ${id} (no API entry point)`,
        );
      }
      return;
    }

    const extensionDir = manifest.name;
    if (!extensionDir) return;

    // eslint-disable-next-line no-underscore-dangle
    const apiBundlePath = this._getExtensionBundlePath(extensionDir, manifest.main);

    // eslint-disable-next-line no-underscore-dangle
    await this._ensureReady();

    const apiModule = this.loadModule(apiBundlePath);
    const extensionApi = apiModule.default || apiModule;

    if (extensionApi && typeof extensionApi[hookName] === 'function') {
      if (__DEV__) {
        const version = manifest.version || '0.0.0';
        console.log(
          `[ServerExtensionManager] Running ${hookName} hook for ${id} (v${version})`,
        );
      }
      await extensionApi[hookName](this.registry, this[EXTENSION_CONTEXT]);
      console.log(
        `[ServerExtensionManager] Successfully executed ${hookName} hook for ${id}`,
      );
    } else if (__DEV__) {
      console.log(
        `[ServerExtensionManager] Extension ${id} does not expose a ${hookName} hook. Skipping.`,
      );
    }
  }

  /**
   * Server-specific install: loads the API module from disk and runs
   * the install() lifecycle hook directly.
   *
   * Overrides `BaseExtensionManager.installExtension()` which delegates to the
   * registry. On the server the extension may not yet be registered in the
   * Registry, so we load the module from disk via `_runLifecycleHook`.
   *
   * @param {string} id - Extension key
   * @param {Object} manifest - Extension manifest object (must contain `name` and `main`)
   * @returns {Promise<boolean>} True if the hook ran successfully
   */
  async installExtension(id, manifest) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Extension ID must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('extension:validation-failed', { id, error });
      console.error(error);
      return false;
    }

    await this.emit('extension:installing', { id });

    try {
      // eslint-disable-next-line no-underscore-dangle
      await this._runLifecycleHook(id, 'install', manifest);
      await this.emit('extension:installed', { id });
      return true;
    } catch (error) {
      console.error(
        `[ServerExtensionManager] Failed to install extension "${id}":`,
        error,
      );
      await this.emit('extension:install-failed', { id, error });
      throw error;
    }
  }

  /**
   * Server-specific uninstall: loads the API module from disk and runs
   * the uninstall() lifecycle hook directly.
   *
   * Overrides `BaseExtensionManager.uninstallExtension()` which delegates to the
   * registry. On the server the extension may already be unloaded from the
   * Registry, so we load the module from disk via `_runLifecycleHook`.
   *
   * @param {string} id - Extension key
   * @param {Object} manifest - Extension manifest object (must contain `name` and `main`)
   * @returns {Promise<boolean>} True if the hook ran successfully
   */
  async uninstallExtension(id, manifest) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Extension ID must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('extension:validation-failed', { id, error });
      console.error(error);
      return false;
    }

    await this.emit('extension:uninstalling', { id });

    try {
      // eslint-disable-next-line no-underscore-dangle
      await this._runLifecycleHook(id, 'uninstall', manifest);
      await this.emit('extension:uninstalled', { id });
      return true;
    } catch (error) {
      console.error(
        `[ServerExtensionManager] Failed to uninstall extension "${id}":`,
        error,
      );
      await this.emit('extension:uninstall-failed', { id, error });
      throw error;
    }
  }

  /**
   * Load extension module (server uses require, not MF containers)
   * @param {string} id - Extension ID
   * @param {string|null} entryPoint - Resolved entry point filename
   * @param {object} manifest - Extension manifest
   * @param {object} options - Additional options (containerName)
   * @returns {Promise<Object|null>} Extension module or null
   */
  async loadExtensionModule(id, entryPoint, manifest, _options) {
    // Skip if no entry point resolved (e.g. client-only extension)
    if (!entryPoint) {
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Skipping extension ${id} (no server entry point)`,
        );
      }
      return null;
    }

    const startTime = Date.now();
    const currentVersion = (manifest && manifest.version) || '0.0.0';
    // The manifest name IS the FS directory name (set by the build task)
    const extensionDir = manifest && manifest.name;

    try {
      // Validate extension directory name early (fail-fast)
      if (!extensionDir) {
        const error = new Error(
          `Extension name required for server-side extension loading: ${id}`,
        );
        error.code = 'EXTENSION_NAME_REQUIRED';
        error.extensionId = id;
        throw error;
      }

      // Ensure server is ready before loading any extension
      // eslint-disable-next-line no-underscore-dangle
      await this._ensureReady();

      // Version-based cache invalidation
      const loadedVersion = this[LOADED_VERSIONS].get(id);
      const versionChanged = currentVersion && loadedVersion !== currentVersion;

      let extensionModule = null;

      // 1. Load View Module if browser entry exists
      if (manifest && manifest.browser) {
        // eslint-disable-next-line no-underscore-dangle
        const bundlePath = this._getExtensionBundlePath(
          path.join(extensionDir, path.dirname(manifest.browser)),
          'server.js',
        );
        if (__DEV__) {
          console.log(
            `[ServerExtensionManager] Loading extension ${id} from ${bundlePath}${versionChanged ? ' (version changed)' : ''}`,
          );
        }
        const viewModule = this.loadModule(bundlePath);
        extensionModule = viewModule.default || viewModule;
      }

      // 2. Boot API if main entry exists
      if (manifest && manifest.main) {
        // eslint-disable-next-line no-underscore-dangle
        const apiBundlePath = this._getExtensionBundlePath(
          extensionDir,
          manifest.main,
        );
        try {
          const apiModule = this.loadModule(apiBundlePath);
          const extensionApi = apiModule.default || apiModule;

          // Object-only pattern: extensions must export { init(context), destroy?(context) }
          if (extensionApi && typeof extensionApi.init === 'function') {
            if (__DEV__) {
              console.log(`[ServerExtensionManager] Booting API for ${id}`);
            }
            try {
              await extensionApi.init(this.registry, this[EXTENSION_CONTEXT]);
              // Store API instance for destroy during unload
              this[EXTENSION_API_ENTRY_POINTS].set(id, extensionApi);
            } catch (error) {
              console.error(
                `[ServerExtensionManager] Failed to boot API for ${id}:`,
                error,
              );
              this.emit('extension:error', { id, error, phase: 'api-boot' });
            }
          } else {
            console.warn(
              `[ServerExtensionManager] Extension has no init method in API module`,
            );
          }
        } catch (err) {
          console.warn(
            `[ServerExtensionManager] Failed to boot API for ${id}:`,
            err.message,
          );
        }
      }

      // Track loaded version
      this[LOADED_VERSIONS].set(id, currentVersion);

      // Performance monitoring
      const loadTime = Date.now() - startTime;
      if (__DEV__) {
        console.log(
          `[ServerExtensionManager] Successfully loaded extension: ${id} v${currentVersion} (${loadTime}ms)`,
        );
        if (loadTime > 500) {
          console.warn(
            `[ServerExtensionManager] Slow extension load detected: ${id} took ${loadTime}ms`,
          );
        }
      }

      // Return extension module if available
      if (extensionModule) {
        return extensionModule;
      }

      // API-only extension: return synthetic object for registry validation
      if (entryPoint === 'api.js') {
        return {
          name: id,
          version: currentVersion,
          register: () => [],
        };
      }

      return null;
    } catch (err) {
      const error = new Error(`Failed to load extension "${id}": ${err.message}`);
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
   * does a complete fetchAll().
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

    // Targeted refresh: resolve names → IDs, read manifests from disk
    const resolvedEntries = []; // Array of { id, manifest }

    for (const name of extensionIds) {
      // Resolve the extension ID from metadata (build names → internal IDs)
      for (const [id, metadata] of this[EXTENSION_METADATA].entries()) {
        const manifestName = metadata.manifest && metadata.manifest.name;
        if (id === name || (manifestName && manifestName === name)) {
          // Read fresh manifest from disk
          const extensionKey = manifestName || name;
          const { dir } = this.resolveExtensionDir(extensionKey);

          let freshManifest = dir ? this.readManifest(dir) : null;
          if (!freshManifest) {
            // Fall back to the last-known manifest
            freshManifest = metadata.manifest;
          } else {
            // Enrich manifest with client asset flags (like the service does)
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

          resolvedEntries.push({
            id,
            manifest: { ...freshManifest, fromDisk: true },
          });
          break;
        }
      }
    }

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

    // Unload each extension (triggers destroy lifecycle)
    for (const { id } of resolvedEntries) {
      if (this[ACTIVE_EXTENSIONS].has(id)) {
        await this.unloadExtension(id);
      }
      this[EXTENSION_METADATA].delete(id);
      this[LOADED_VERSIONS].delete(id);
    }

    // Reload each extension with the fresh disk manifest
    // (loadExtension will skip the HTTP fetch because containerName is populated)
    await Promise.all(
      resolvedEntries.map(({ id, manifest }) => this.loadExtension(id, manifest)),
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
  subscribeToEvents() {
    // No WebSocket subscriptions on server
  }

  /**
   * Handle external event (No-op on server - server doesn't receive WebSocket events)
   * @param {Object} _event - Event object (unused)
   */
  async handleEvent(_event) {
    // Server-side event handling is not supported
    // Extensions are loaded at initialization and reloaded on server restart
    if (__DEV__) {
      console.warn(
        '[ServerExtensionManager] handleEvent called on server - this is a no-op',
      );
    }
  }
}

// Export singleton instance
const extensionManager = new ServerExtensionManager();

export default extensionManager;
