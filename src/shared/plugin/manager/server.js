/**
 * React Starter Kit (https://github.com/xuanhoa/rapid-rsk/)
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
  PLUGIN_API_INSTANCES,
} from './base';

class ServerPluginManager extends BasePluginManager {
  /**
   * Get the plugin bundle path
   * @param {string} internalId - Plugin internal ID (folder name)
   * @param {string} filename - Bundle filename
   * @returns {string} Plugin bundle path
   */
  getPluginBundlePath(internalId, filename) {
    const pluginDir = path.resolve(
      this[PLUGIN_CONTEXT].cwd,
      process.env.RSK_PLUGIN_PATH || 'plugins',
    );
    return path.join(pluginDir, internalId, filename);
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
   * @returns {string} Entry point filename
   */
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
   * Load plugin module (server uses require, not MF containers)
   * @param {string} id - Plugin ID
   * @param {string|null} entryPoint - Resolved entry point filename
   * @param {object} manifest - Plugin manifest with internalId
   * @param {object} options - Additional options (internalId)
   * @returns {Promise<Object|null>} Plugin module or null
   */
  async loadPluginModule(id, entryPoint, manifest, options) {
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
    const internalId =
      (options && options.internalId) || (manifest && manifest.internalId);

    try {
      // Validate internalId early (fail-fast)
      if (!internalId) {
        const error = new Error(
          `Internal ID required for server-side plugin loading: ${id}`,
        );
        error.code = 'INTERNAL_ID_REQUIRED';
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
        const bundlePath = this.getPluginBundlePath(
          path.join(internalId, path.dirname(manifest.browser)),
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
        const apiBundlePath = this.getPluginBundlePath(
          internalId,
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
            await pluginApi.init(this[PLUGIN_CONTEXT]);
            // Store API instance for destroy during unload
            this[PLUGIN_API_INSTANCES].set(id, pluginApi);
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
      error.internalId = internalId;
      error.originalError = err;

      console.error(`[ServerPluginManager] ${error.message}`, {
        internalId,
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
