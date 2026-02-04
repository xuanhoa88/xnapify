/**
 * React Starter Kit (https://github.com/xuanhoa/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';
import { BasePluginManager, PLUGIN_CONTEXT } from './base';

class ServerPluginManager extends BasePluginManager {
  /**
   * Initialize the server plugin manager
   *
   * On the server, we might want to do additional logging or cleanup,
   * but generally we just need the base functionality without
   * the client-side event listeners.
   */

  /**
   * Load plugin module
   */
  async loadPluginModule(id, code, manifest, internalId) {
    // Ideally, internalId gives us the directory name.
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
      // Use explicitly provided pluginDir from context, or resolve relative to CWD
      const pluginDir = path.resolve(
        (this[PLUGIN_CONTEXT] && this[PLUGIN_CONTEXT].cwd) || process.cwd(),
        process.env.RSK_PLUGIN_PATH || 'plugins',
      );

      // Get plugin bundle path
      const bundlePath = path.join(pluginDir, internalId, 'server.js');

      // Delete require cache to ensure we get the latest version
      delete require.cache[bundlePath];

      // eslint-disable-next-line no-undef
      const requireFunc =
        // eslint-disable-next-line no-undef
        typeof __non_webpack_require__ === 'function'
          ? // eslint-disable-next-line no-undef
            __non_webpack_require__
          : require;
      const module = requireFunc(bundlePath);

      console.log(`[ServerPluginManager] Successfully imported plugin: ${id}`);
      return module.default || module;
    } catch (err) {
      console.error(
        `[ServerPluginManager] Failed to import plugin ${id}:`,
        err,
      );

      if (__DEV__) {
        throw err;
      }
      return null;
    }
  }

  /**
   * Subscribe to events (No-op on server)
   */
  subscribeToEvents() {
    // No WebSocket subscriptions on server
  }
}

// Export singleton instance
const pluginManager = new ServerPluginManager();

export default pluginManager;
