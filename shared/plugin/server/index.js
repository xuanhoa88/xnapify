/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';
import {
  BasePluginManager,
  PLUGIN_CONTEXT,
  LOADED_VERSIONS,
  PLUGIN_MANAGER_INIT,
  PLUGIN_METADATA,
} from '../utils/BasePluginManager';

// Symbols for internal state
const PLUGIN_API_ENTRY_POINTS = Symbol('__rsk.pluginApiEntryPoints__');
const PLUGIN_CSS_ENTRY_POINTS = Symbol('__rsk.pluginCssEntryPoints__');
const PLUGIN_SCRIPT_ENTRY_POINTS = Symbol('__rsk.pluginScriptEntryPoints__');

class ServerPluginManager extends BasePluginManager {
  constructor() {
    super();
    this[PLUGIN_API_ENTRY_POINTS] = new Map(); // id -> api instances
    this[PLUGIN_CSS_ENTRY_POINTS] = new Map(); // id -> css URL string
    this[PLUGIN_SCRIPT_ENTRY_POINTS] = new Map(); // id -> script URL string

    // Store CSS entry points when plugin is loaded
    this.on('plugin:loaded', async ({ id }) => {
      try {
        const metadata = this[PLUGIN_METADATA].get(id);
        const manifest = metadata && metadata.manifest;
        const currentVersion = (manifest && manifest.version) || '0.0.0';

        // Store CSS entry points when plugin is loaded
        if (manifest && manifest.hasClientCss) {
          this[PLUGIN_CSS_ENTRY_POINTS].set(
            id,
            this.getPluginAssetUrl(id, `plugin.css?v=${currentVersion}`),
          );
        }

        // Store script entry points when plugin is loaded
        // Include the browser MF container (remote.js) so it is SSR-injected
        if (manifest && manifest.hasClientScript) {
          this[PLUGIN_SCRIPT_ENTRY_POINTS].set(
            id,
            this.getPluginAssetUrl(id, `remote.js?v=${currentVersion}`),
          );
        }
      } catch (err) {
        console.error(
          `[PluginManager] Failed to store CSS entry points for ${id}:`,
          err,
        );
        this.emit('plugin:error', { id, error: err, phase: 'script-setup' });
      }
    });

    // Clean up API instances when plugin is unloaded
    this.on('plugin:unloaded', async ({ id }) => {
      try {
        const apiPlugin = this[PLUGIN_API_ENTRY_POINTS].get(id);
        if (apiPlugin && typeof apiPlugin.destroy === 'function') {
          await apiPlugin.destroy(this.registry, this[PLUGIN_CONTEXT]);
          if (__DEV__) {
            console.log(`[PluginManager] Destroyed API for: ${id}`);
          }
        }
      } catch (err) {
        console.error(`[PluginManager] Failed to destroy API for ${id}:`, err);
        this.emit('plugin:error', { id, error: err, phase: 'api-destroy' });
      }
      this[PLUGIN_API_ENTRY_POINTS].delete(id);
      this[PLUGIN_CSS_ENTRY_POINTS].delete(id);
      this[PLUGIN_SCRIPT_ENTRY_POINTS].delete(id);
    });

    // Clear internal maps when manager is destroyed
    this.on('manager:destroyed', () => {
      this[PLUGIN_API_ENTRY_POINTS].clear();
      this[PLUGIN_CSS_ENTRY_POINTS].clear();
      this[PLUGIN_SCRIPT_ENTRY_POINTS].clear();
    });
  }

  /**
   * Get all plugin CSS entries for SSR injection
   * @returns {Array<{href: string, id: string}>}
   */
  get cssUrls() {
    const entries = [];
    for (const [id, href] of this[PLUGIN_CSS_ENTRY_POINTS]) {
      entries.push({ href, id });
    }
    return entries;
  }

  /**
   * Get all plugin script entries for SSR injection
   * @returns {Array<{src: string, id: string}>}
   */
  get scriptUrls() {
    const entries = [];
    for (const [id, src] of this[PLUGIN_SCRIPT_ENTRY_POINTS]) {
      entries.push({ src, id });
    }
    return entries;
  }

  /**
   * Get the path to a plugin's bundle file
   * @param {string} pluginDir - Plugin directory name
   * @param {string} filename - Bundle filename
   * @returns {string} Absolute path to the bundle file
   */
  _getPluginBundlePath(pluginDir, filename) {
    const baseDir = path.resolve(
      this[PLUGIN_CONTEXT].cwd,
      process.env.RSK_PLUGIN_PATH || 'plugins',
    );
    return path.join(baseDir, pluginDir, filename);
  }

  /**
   * Load a module using non-webpack require
   * @param {string} bundlePath - Absolute path to the bundle
   * @returns {Object} Module exports
   */
  loadModule(bundlePath) {
    // Delete require cache to ensure we get the latest version
    delete require.cache[bundlePath];

    // Use non-webpack require to load plugins from filesystem
    // eslint-disable-next-line no-undef
    const requireFunc =
      typeof __non_webpack_require__ === 'function'
        ? // eslint-disable-next-line no-undef
          __non_webpack_require__
        : require;

    return requireFunc(bundlePath);
  }

  /**
   * Validate server environment and context
   * @throws {Error} If context is invalid
   */
  _validateServerContext() {
    if (
      typeof this[PLUGIN_CONTEXT].cwd !== 'string' ||
      this[PLUGIN_CONTEXT].cwd.trim().length === 0
    ) {
      if (__DEV__) {
        console.warn(
          '[ServerPluginManager] Running without explicit cwd, using process.cwd()',
        );
      }
      this[PLUGIN_CONTEXT].cwd = process.cwd();
    }
  }

  /**
   * Ensure server plugin manager is ready
   * For SSR: Ensures context is valid before loading plugins
   * @returns {Promise<void>}
   */
  async _ensureReady() {
    if (this[PLUGIN_MANAGER_INIT]) {
      return this[PLUGIN_MANAGER_INIT];
    }

    this[PLUGIN_MANAGER_INIT] = (async () => {
      // Validate server context
      // eslint-disable-next-line no-underscore-dangle
      this._validateServerContext();

      if (__DEV__) {
        console.log('[ServerPluginManager] Server plugin manager ready');
      }
    })();

    return this[PLUGIN_MANAGER_INIT];
  }

  /**
   * Resolve the plugin entry point based on manifest
   * @param {Object} manifest - Plugin manifest
   * @returns {string|null} Entry point filename or null
   */
  resolveEntryPoint(manifest) {
    // If browser exists, we have a View (server.js) generated from it
    if (manifest && manifest.browser) return 'server.js';
    if (manifest && manifest.main) return 'api.js';
    return null;
  }

  /**
   * Run a lifecycle hook from the plugin's API module.
   * Uses the provided manifest to resolve the API bundle path and calls the
   * named export.  The caller MUST supply the manifest — this method does NOT
   * perform any API fetch.
   *
   * @param {string} id - Plugin key (e.g. 'rsk_plugin_test')
   * @param {string} hookName - Name of the hook (e.g. 'install', 'uninstall')
   * @param {Object} manifest - Plugin manifest (must contain `name` and `main`)
   * @returns {Promise<void>}
   * @private
   */
  async _runLifecycleHook(id, hookName, manifest) {
    if (!manifest || !manifest.main) {
      if (__DEV__) {
        console.log(
          `[ServerPluginManager] Skipping ${hookName} hook for ${id} (no API entry point)`,
        );
      }
      return;
    }

    const pluginDir = manifest.name;
    if (!pluginDir) return;

    // eslint-disable-next-line no-underscore-dangle
    const apiBundlePath = this._getPluginBundlePath(pluginDir, manifest.main);

    // eslint-disable-next-line no-underscore-dangle
    await this._ensureReady();

    const apiModule = this.loadModule(apiBundlePath);
    const pluginApi = apiModule.default || apiModule;

    if (pluginApi && typeof pluginApi[hookName] === 'function') {
      if (__DEV__) {
        const version = manifest.version || '0.0.0';
        console.log(
          `[ServerPluginManager] Running ${hookName} hook for ${id} (v${version})`,
        );
      }
      await pluginApi[hookName](this.registry, this[PLUGIN_CONTEXT]);
      console.log(
        `[ServerPluginManager] Successfully executed ${hookName} hook for ${id}`,
      );
    } else if (__DEV__) {
      console.log(
        `[ServerPluginManager] Plugin ${id} does not expose a ${hookName} hook. Skipping.`,
      );
    }
  }

  /**
   * Install a plugin — calls the plugin's install() lifecycle hook.
   * Overrides BasePluginManager to load the API module from disk
   * (the plugin may not yet be registered in the Registry).
   *
   * @param {string} id - Plugin key (e.g. 'rsk_plugin_test')
   * @param {Object} manifest - Plugin manifest object (must contain `name` and `main`)
   * @returns {Promise<boolean>} True if the hook ran successfully
   */
  async installPlugin(id, manifest) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Plugin ID must be a non-empty string');
      error.name = 'PluginManagerError';
      await this.emit('plugin:validation-failed', { id, error });
      console.error(error);
      return false;
    }

    await this.emit('plugin:installing', { id });

    try {
      // eslint-disable-next-line no-underscore-dangle
      await this._runLifecycleHook(id, 'install', manifest);
      await this.emit('plugin:installed', { id });
      return true;
    } catch (error) {
      console.error(
        `[ServerPluginManager] Failed to install plugin "${id}":`,
        error,
      );
      await this.emit('plugin:install-failed', { id, error });
      throw error;
    }
  }

  /**
   * Uninstall a plugin — calls the plugin's uninstall() lifecycle hook.
   * Overrides BasePluginManager to load the API module from disk
   * (the plugin may already be unloaded from the Registry).
   *
   * @param {string} id - Plugin key (e.g. 'rsk_plugin_test')
   * @param {Object} manifest - Plugin manifest object (must contain `name` and `main`)
   * @returns {Promise<boolean>} True if the hook ran successfully
   */
  async uninstallPlugin(id, manifest) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Plugin ID must be a non-empty string');
      error.name = 'PluginManagerError';
      await this.emit('plugin:validation-failed', { id, error });
      console.error(error);
      return false;
    }

    await this.emit('plugin:uninstalling', { id });

    try {
      // eslint-disable-next-line no-underscore-dangle
      await this._runLifecycleHook(id, 'uninstall', manifest);
      await this.emit('plugin:uninstalled', { id });
      return true;
    } catch (error) {
      console.error(
        `[ServerPluginManager] Failed to uninstall plugin "${id}":`,
        error,
      );
      await this.emit('plugin:uninstall-failed', { id, error });
      throw error;
    }
  }

  /**
   * Load plugin module (server uses require, not MF containers)
   * @param {string} id - Plugin ID
   * @param {string|null} entryPoint - Resolved entry point filename
   * @param {object} manifest - Plugin manifest
   * @param {object} options - Additional options (containerName)
   * @returns {Promise<Object|null>} Plugin module or null
   */
  async loadPluginModule(id, entryPoint, manifest, _options) {
    // Skip if no entry point resolved (e.g. client-only plugin)
    if (!entryPoint) {
      if (__DEV__) {
        console.log(
          `[ServerPluginManager] Skipping plugin ${id} (no server entry point)`,
        );
      }
      return null;
    }

    const startTime = Date.now();
    const currentVersion = (manifest && manifest.version) || '0.0.0';
    // The manifest name IS the FS directory name (set by the build task)
    const pluginDir = manifest && manifest.name;

    try {
      // Validate plugin directory name early (fail-fast)
      if (!pluginDir) {
        const error = new Error(
          `Plugin name required for server-side plugin loading: ${id}`,
        );
        error.code = 'PLUGIN_NAME_REQUIRED';
        error.pluginId = id;
        throw error;
      }

      // Ensure server is ready before loading any plugin
      // eslint-disable-next-line no-underscore-dangle
      await this._ensureReady();

      // Version-based cache invalidation
      const loadedVersion = this[LOADED_VERSIONS].get(id);
      const versionChanged = currentVersion && loadedVersion !== currentVersion;

      let pluginModule = null;

      // 1. Load View Module if browser entry exists
      if (manifest && manifest.browser) {
        // eslint-disable-next-line no-underscore-dangle
        const bundlePath = this._getPluginBundlePath(
          path.join(pluginDir, path.dirname(manifest.browser)),
          'server.js',
        );
        if (__DEV__) {
          console.log(
            `[ServerPluginManager] Loading plugin ${id} from ${bundlePath}${versionChanged ? ' (version changed)' : ''}`,
          );
        }
        const viewModule = this.loadModule(bundlePath);
        pluginModule = viewModule.default || viewModule;
      }

      // 2. Boot API if main entry exists
      if (manifest && manifest.main) {
        // eslint-disable-next-line no-underscore-dangle
        const apiBundlePath = this._getPluginBundlePath(
          pluginDir,
          manifest.main,
        );
        try {
          const apiModule = this.loadModule(apiBundlePath);
          const pluginApi = apiModule.default || apiModule;

          // Object-only pattern: plugins must export { init(context), destroy?(context) }
          if (pluginApi && typeof pluginApi.init === 'function') {
            if (__DEV__) {
              console.log(`[ServerPluginManager] Booting API for ${id}`);
            }
            try {
              await pluginApi.init(this.registry, this[PLUGIN_CONTEXT]);
              // Store API instance for destroy during unload
              this[PLUGIN_API_ENTRY_POINTS].set(id, pluginApi);
            } catch (error) {
              console.error(
                `[ServerPluginManager] Failed to boot API for ${id}:`,
                error,
              );
              this.emit('plugin:error', { id, error, phase: 'api-boot' });
            }
          } else {
            console.warn(
              `[ServerPluginManager] Plugin ${id} has no init method in API module`,
            );
          }
        } catch (err) {
          console.warn(
            `[ServerPluginManager] Failed to boot API for ${id}:`,
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
          `[ServerPluginManager] Successfully loaded plugin: ${id} v${currentVersion} (${loadTime}ms)`,
        );
        if (loadTime > 500) {
          console.warn(
            `[ServerPluginManager] Slow plugin load detected: ${id} took ${loadTime}ms`,
          );
        }
      }

      // Return plugin module if available
      if (pluginModule) {
        return pluginModule;
      }

      // API-only plugin: return synthetic object for registry validation
      if (entryPoint === 'api.js') {
        return {
          name: id,
          version: currentVersion,
          register: () => [],
        };
      }

      return null;
    } catch (err) {
      const error = new Error(`Failed to load plugin "${id}": ${err.message}`);
      error.code = err.code || 'PLUGIN_LOAD_FAILED';
      error.pluginId = id;
      error.originalError = err;

      console.error(`[ServerPluginManager] ${error.message}`, {
        pluginDir,
        pluginId: id,
        version: currentVersion,
        error: err.message,
        stack: __DEV__ ? err.stack : undefined,
      });

      throw error;
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
    // Plugins are loaded at initialization and reloaded on server restart
    if (__DEV__) {
      console.warn(
        '[ServerPluginManager] handleEvent called on server - this is a no-op',
      );
    }
  }
}

// Export singleton instance
const pluginManager = new ServerPluginManager();

export default pluginManager;
