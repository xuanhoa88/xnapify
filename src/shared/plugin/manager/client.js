/**
 * React Starter Kit (https://github.com/xuanhoa/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { BasePluginManager } from './base';

// Symbol to store initialization promise
const PLUGIN_MANAGER_INIT = Symbol('__rsk.pluginManagerInit__');

class ClientPluginManager extends BasePluginManager {
  constructor() {
    super();
    this[PLUGIN_MANAGER_INIT] = null;
  }

  /**
   * Ensure Module Federation shared scope is initialized
   * For SSR: Wait for hydration to complete before loading plugins
   */
  async _ensureSharedScopeInitialized() {
    if (this[PLUGIN_MANAGER_INIT]) {
      return this[PLUGIN_MANAGER_INIT];
    }

    this[PLUGIN_MANAGER_INIT] = (async () => {
      // Wait for SSR hydration to complete
      if (document.readyState !== 'complete') {
        await new Promise(resolve => {
          window.addEventListener('load', resolve, { once: true });
        });
      }

      // Extra delay for React hydration to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify shared scope is available
      if (
        typeof __webpack_share_scopes__ === 'undefined' ||
        // eslint-disable-next-line no-undef
        !__webpack_share_scopes__.default
      ) {
        console.warn(
          '[ClientPluginManager] Module Federation shared scope not found.',
        );
      } else if (__DEV__) {
        console.log(
          '[ClientPluginManager] Module Federation ready for plugins',
        );
      }
    })();

    return this[PLUGIN_MANAGER_INIT];
  }

  /**
   * Load plugin module as MF remote container
   * @param {string} id - Plugin ID
   * @param {object} _manifest - Plugin manifest
   * @param {string} containerName - MF container name (window global)
   */
  async loadPluginModule(id, _manifest, containerName) {
    try {
      // Build script URL from plugin ID
      const scriptUrl = `/api/plugins/${id}/static/plugin.js`;

      // Ensure shared scope is ready before loading any plugin
      // eslint-disable-next-line no-underscore-dangle
      await this._ensureSharedScopeInitialized();

      if (__DEV__) {
        console.log(
          `[ClientPluginManager] Loading plugin ${id} from ${scriptUrl}`,
        );
      }

      // Load the plugin.js script via script tag
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = e => {
          const err = new Error(
            `Failed to load plugin script: ${e.message || e}`,
          );
          err.name = 'PluginManagerError';
          reject(err);
        };

        // Append to body (after vendor scripts)
        document.body.appendChild(script);
      });

      // Get the container from window
      const container = window[containerName];
      if (!container) {
        const err = new Error(
          `Plugin container ${containerName} not found on window after script loaded`,
        );
        err.name = 'PluginManagerError';
        throw err;
      }
      // Initialize the container with the host's shared scope
      // eslint-disable-next-line no-undef
      // Check if container is already initialized (has __initialized__ flag)
      // Module Federation containers can only be init'd once
      // eslint-disable-next-line no-underscore-dangle
      if (!container.__initialized__) {
        // eslint-disable-next-line no-undef
        await container.init(__webpack_share_scopes__.default);
        // eslint-disable-next-line no-underscore-dangle
        container.__initialized__ = true;
      }
      // Get the exposed plugin module
      const factory = await container.get('./plugin');
      const pluginModule = factory();

      if (__DEV__) {
        console.log(`[ClientPluginManager] Successfully loaded plugin: ${id}`);
      }

      return pluginModule.default || pluginModule;
    } catch (e) {
      console.error(`[ClientPluginManager] Failed to load plugin ${id}:`, e);

      // In production, don't crash the app - just skip the plugin
      if (__DEV__) {
        throw e;
      }

      return null;
    }
  }

  /**
   * Subscribe to WebSocket events (Client only)
   */
  subscribeToEvents() {
    console.log('[ClientPluginManager] Ready to receive WebSocket events');
  }

  /**
   * Handle external event (e.g., from WebSocket)
   * @param {Object} event - Event object
   */
  async handleEvent(event) {
    if (!event || !event.type) {
      console.warn('[ClientPluginManager] Invalid event received:', event);
      return;
    }

    const { type, pluginId, data } = event;

    try {
      switch (type) {
        case 'PLUGIN_INSTALLED':
          await this.loadPlugin(pluginId, data && data.manifest);
          break;

        case 'PLUGIN_UNINSTALLED':
          await this.unloadPlugin(pluginId);
          break;

        case 'PLUGIN_UPDATED':
          await this.reloadPlugin(pluginId);
          break;

        default:
          console.warn(`[ClientPluginManager] Unknown event type: ${type}`);
      }
    } catch (error) {
      console.error(
        `[ClientPluginManager] Error handling event "${type}":`,
        error,
      );
    }
  }
}

// Export singleton instance
const pluginManager = new ClientPluginManager();

export default pluginManager;
