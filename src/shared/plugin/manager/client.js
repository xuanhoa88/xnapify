/**
 * React Starter Kit (https://github.com/xuanhoa/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  BasePluginManager,
  LOADED_VERSIONS,
  PLUGIN_MANAGER_INIT,
} from './base';

class ClientPluginManager extends BasePluginManager {
  constructor() {
    super();

    // Clean up DOM resources when plugin is unloaded
    this.on('plugin:unloaded', ({ id }) => {
      try {
        // Remove CSS links (SSR-injected or dynamically added)
        const cssLinks = document.querySelectorAll(
          `link[href^="/api/plugins/${id}/static/"][rel="stylesheet"]`,
        );
        cssLinks.forEach(link => {
          link.remove();
          if (__DEV__) {
            console.log(`[PluginManager] Removed CSS: ${link.href}`);
          }
        });

        // Remove JS scripts (by plugin ID data attribute)
        const scripts = document.querySelectorAll(
          `script[data-plugin-id="${id}"]`,
        );
        scripts.forEach(script => {
          script.remove();
          if (__DEV__) {
            console.log(`[PluginManager] Removed script for: ${id}`);
          }
        });
      } catch (error) {
        console.error(
          `[PluginManager] Failed to remove resources for ${id}:`,
          error,
        );
        this.emit('plugin:error', { id, error, phase: 'dom-cleanup' });
      }
    });
  }
  /**
   * Load a script dynamically
   * @param {string} url - Script URL
   * @param {string} pluginId - Plugin ID for cleanup tracking
   * @param {Object} options - Loading options
   * @returns {Promise<void>}
   */
  async loadScript(url, pluginId, options = {}) {
    return new Promise((resolve, reject) => {
      let script = document.querySelector(`script[src="${url}"]`);

      // Check if already loaded
      if (script && script.complete) {
        return resolve();
      }

      if (!script) {
        script = document.createElement('script');
        script.src = url;
        script.async = options.async !== false;
        script.setAttribute('data-plugin-id', pluginId);
        document.body.appendChild(script);
      }

      // If link exists (SSR or just created) but not loaded, wait for it
      const handleLoad = () => {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
        resolve();
      };

      const handleError = e => {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
        const error = new Error(`Failed to load script: ${url}`);
        error.code = 'SCRIPT_LOAD_FAILED';
        error.url = url;
        error.originalError = e;
        reject(error);
      };

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);
    });
  }

  /**
   * Initialize Module Federation container
   * @param {Object} container - MF container
   * @param {string} containerName - Container name
   * @returns {Promise<void>}
   */
  async initializeContainer(container, containerName) {
    // Check if already initialized
    // eslint-disable-next-line no-underscore-dangle
    if (container.__initialized__) {
      return;
    }

    // Verify shared scope is available
    // eslint-disable-next-line no-undef
    if (
      typeof __webpack_share_scopes__ === 'undefined' ||
      // eslint-disable-next-line no-undef
      !__webpack_share_scopes__.default
    ) {
      const error = new Error('Module Federation shared scope not available');
      error.code = 'SHARED_SCOPE_UNAVAILABLE';
      throw error;
    }

    // Initialize with shared scope
    // eslint-disable-next-line no-undef
    await container.init(__webpack_share_scopes__.default);
    // eslint-disable-next-line no-underscore-dangle
    container.__initialized__ = true;

    if (__DEV__) {
      console.log(
        `[ClientPluginManager] Initialized container: ${containerName}`,
      );
    }
  }

  /**
   * Get module from container
   * @param {Object} container - MF container
   * @returns {Promise<Object>} Module
   */
  async getContainerModule(container) {
    const factory = await container.get('./plugin');
    return factory();
  }

  /**
   * Ensure Module Federation shared scope is initialized
   * For SSR: Wait for hydration to complete before loading plugins
   * @returns {Promise<void>}
   */
  async _ensureReady() {
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
      // eslint-disable-next-line no-undef
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
   * Resolve the plugin entry point based on manifest
   * @param {Object} manifest - Plugin manifest
   * @returns {string|null} Entry point filename or null to skip
   */
  resolveEntryPoint(manifest) {
    // If browser entry exists, we always load 'remote.js' which is the Webpack MF container
    return manifest && manifest.browser ? 'remote.js' : null;
  }

  /**
   * Load plugin module as MF remote container
   * @param {string} id - Plugin ID
   * @param {string|null} entryPoint - Resolved entry point filename
   * @param {Object} manifest - Plugin manifest
   * @param {Object} options - Additional options (containerName)
   */
  async loadPluginModule(id, entryPoint, manifest, options) {
    // Skip if no entry point resolved (e.g. server-only plugin)
    if (!entryPoint) {
      if (__DEV__) {
        console.log(
          `[ClientPluginManager] Skipping plugin ${id} (no client entry point)`,
        );
      }
      return null;
    }

    const startTime = Date.now();
    const currentVersion = (manifest && manifest.version) || '0.0.0';
    const containerName = options && options.containerName;

    try {
      // Ensure shared scope is ready before loading any plugin
      // eslint-disable-next-line no-underscore-dangle
      await this._ensureReady();

      // Version-based cache invalidation via URL query parameter
      const loadedVersion = this[LOADED_VERSIONS].get(id);
      const versionChanged = currentVersion && loadedVersion !== currentVersion;

      // Load remote.js (MF container)
      const baseUrl = this.getPluginAssetUrl(id, entryPoint);
      const scriptUrl = versionChanged
        ? `${baseUrl}?v=${currentVersion}`
        : baseUrl;

      if (__DEV__) {
        console.log(
          `[ClientPluginManager] Loading plugin ${id} from ${scriptUrl}`,
        );
      }

      // Load the plugin script
      await this.loadScript(scriptUrl, id);

      // Get the container from window
      const container = window[containerName];
      if (!container) {
        const error = new Error(
          `Plugin container ${containerName} not found on window after script loaded`,
        );
        error.code = 'CONTAINER_NOT_FOUND';
        error.containerName = containerName;
        throw error;
      }

      // Initialize the container with the host's shared scope
      await this.initializeContainer(container, containerName);

      // Get the exposed plugin module
      const pluginModule = await this.getContainerModule(container);

      // Track loaded version for future cache invalidation
      this[LOADED_VERSIONS].set(id, currentVersion);

      // Performance monitoring
      const loadTime = Date.now() - startTime;
      if (__DEV__) {
        console.log(
          `[ClientPluginManager] Successfully loaded plugin: ${id} v${currentVersion} (${loadTime}ms)`,
        );
        if (loadTime > 500) {
          console.warn(
            `[ClientPluginManager] Slow plugin load detected: ${id} took ${loadTime}ms`,
          );
        }
      }

      return pluginModule.default || pluginModule;
    } catch (err) {
      // Enhanced error with full context for debugging
      const error = new Error(`Failed to load plugin "${id}": ${err.message}`);
      error.code = err.code || 'PLUGIN_LOAD_FAILED';
      error.pluginId = id;
      error.containerName = containerName;
      error.originalError = err;

      console.error(`[ClientPluginManager] ${error.message}`, {
        pluginId: id,
        containerName,
        version: currentVersion,
        error: err.message,
        stack: __DEV__ ? err.stack : undefined,
      });

      throw error;
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
