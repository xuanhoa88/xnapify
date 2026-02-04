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
   * Load plugin module
   */
  async loadPluginModule(id, code, _manifest, _internalId) {
    try {
      // Ensure shared scope is ready before loading any plugin
      // eslint-disable-next-line no-underscore-dangle
      await this._ensureSharedScopeInitialized();

      // Additional wait for shared scope to fully propagate
      await new Promise(resolve => setTimeout(resolve, 200));

      // Create and execute the plugin script
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = blobUrl;
        script.async = false;
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

        // DON'T remove the script - Module Federation needs it to stay in DOM
      });

      // Clean up blob URL after script loads
      URL.revokeObjectURL(blobUrl);

      // Retrieve the plugin instance from the global namespace
      const entryId = _internalId || id;
      const entryName = `${entryId}/browser`;

      // Poll for plugin registration (in case wrapper has setTimeout)
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max
      let pluginModule;

      while (attempts < maxAttempts) {
        // eslint-disable-next-line no-underscore-dangle
        pluginModule =
          // eslint-disable-next-line no-underscore-dangle
          window.__rsk__plugins__ && window.__rsk__plugins__[entryName];

        if (pluginModule) {
          // Check if it's an error object
          if (pluginModule.error) {
            const err = new Error(
              `Plugin failed to initialize: ${pluginModule.error}`,
            );
            err.name = 'PluginManagerError';
            throw err;
          }
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!pluginModule) {
        // eslint-disable-next-line no-underscore-dangle
        if (window.__rsk__plugins__ && __DEV__) {
          console.warn(
            '[ClientPluginManager] Available plugins:',
            // eslint-disable-next-line no-underscore-dangle
            Object.keys(window.__rsk__plugins__),
          );
        }

        const err = new Error(
          `Plugin ${id} (entry: ${entryName}) loaded but window.__rsk__plugins__['${entryName}'] is undefined after ${maxAttempts * 100}ms. ` +
            `Check that plugin webpack config uses PluginLibraryWrapperPlugin.`,
        );
        err.name = 'PluginManagerError';
        throw err;
      }

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
