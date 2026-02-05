/**
 * React Starter Kit (https://github.com/xuanhoa/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';
import { BasePluginManager, PLUGIN_CONTEXT, LOADED_VERSIONS } from './base';

// Symbol to store initialization promise
const PLUGIN_MANAGER_INIT = Symbol('__rsk.pluginManagerInit__');

class ServerPluginManager extends BasePluginManager {
  constructor() {
    super();
    this[PLUGIN_MANAGER_INIT] = null;
    // Track loaded plugin versions for intelligent cache invalidation
    this[LOADED_VERSIONS] = new Map(); // pluginId -> version
  }

  /**
   * Get the plugin bundle path
   * @param {string} internalId - Plugin internal ID (folder name)
   * @param {string} [filename='server.js'] - Bundle filename
   * @returns {string} Plugin bundle path
   */
  getPluginBundlePath(internalId, filename = 'server.js') {
    const pluginDir = path.resolve(
      (this[PLUGIN_CONTEXT] && this[PLUGIN_CONTEXT].cwd) || process.cwd(),
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
    if (!this[PLUGIN_CONTEXT] || typeof this[PLUGIN_CONTEXT].cwd !== 'string') {
      if (__DEV__) {
        console.warn(
          '[ServerPluginManager] Running without explicit cwd, using process.cwd()',
        );
      }
    }
  }

  /**
   * Ensure server plugin manager is ready
   * For SSR: Ensures context is valid before loading plugins
   */
  async _ensureServerReady() {
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
   * Load plugin module (server uses require, not MF containers)
   * @param {string} id - Plugin ID
   * @param {object} manifest - Plugin manifest with internalId
   * @param {string} _containerName - Not used on server (MF container name)
   */
  async loadPluginModule(id, manifest, _containerName) {
    const startTime = Date.now();
    const currentVersion = (manifest && manifest.version) || '0.0.0';

    // Server uses direct require, not MF containers
    // Get internalId from the API response (passed via base manager)
    const internalId = manifest && manifest.internalId;

    if (!internalId) {
      if (__DEV__) {
        const error = new Error(
          'Internal ID required for server-side plugin loading',
        );
        error.code = 'INTERNAL_ID_REQUIRED';
        throw error;
      }
      return null;
    }

    try {
      // Ensure server is ready before loading any plugin
      // eslint-disable-next-line no-underscore-dangle
      await this._ensureServerReady();

      // Version-based cache invalidation
      const loadedVersion = this[LOADED_VERSIONS].get(id);
      const versionChanged = currentVersion && loadedVersion !== currentVersion;

      // Get plugin bundle path
      const bundlePath = this.getPluginBundlePath(internalId);

      if (__DEV__) {
        console.log(
          `[ServerPluginManager] Loading plugin ${id} from ${bundlePath}${versionChanged ? ' (version changed)' : ''}`,
        );
      }

      // Load the plugin module
      const pluginModule = this.loadModule(bundlePath);

      // Track loaded version for future cache invalidation
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

      return pluginModule.default || pluginModule;
    } catch (err) {
      // Enhanced error with full context for debugging
      const error = new Error(`Failed to load plugin "${id}": ${err.message}`);
      error.code = err.code || 'PLUGIN_LOAD_FAILED';
      error.pluginId = id;
      error.internalId = internalId;
      error.originalError = err;

      console.error(`[ServerPluginManager] ${error.message}`, {
        pluginId: id,
        internalId,
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
