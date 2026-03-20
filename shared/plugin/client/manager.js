/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  BasePluginManager,
  PLUGIN_MANAGER_INIT,
} from '../utils/BasePluginManager';

// Private symbol for reload state
const NEEDS_RELOAD = Symbol('__rsk.needsReloadPlugins__');

class ClientPluginManager extends BasePluginManager {
  constructor() {
    super();

    this[NEEDS_RELOAD] = false;

    // Inject CSS and script tags when a plugin is loaded at runtime
    this.on('plugin:loaded', ({ id, manifest }) => {
      if (!manifest) return;

      const version = manifest.version || '0.0.0';

      // Inject plugin.css
      if (manifest.hasClientCss) {
        if (!document.querySelector(`link[data-plugin-id="${id}"]`)) {
          const href = this.getPluginAssetUrl(id, `plugin.css?v=${version}`);
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          link.setAttribute('data-plugin-id', id);
          document.head.appendChild(link);
          if (__DEV__) {
            console.log(`[PluginManager] Injected CSS: ${href}`);
          }
        }
      }

      // Inject remote.js (MF container)
      if (manifest.hasClientScript) {
        if (!document.querySelector(`script[data-plugin-id="${id}"]`)) {
          const src = this.getPluginAssetUrl(id, `remote.js?v=${version}`);
          const script = document.createElement('script');
          script.src = src;
          script.async = true;
          script.setAttribute('data-plugin-id', id);
          document.body.appendChild(script);
          if (__DEV__) {
            console.log(`[PluginManager] Injected script: ${src}`);
          }
        }
      }
    });

    // Remove CSS and script tags when a plugin is unloaded at runtime
    this.on('plugin:unloaded', ({ id }) => {
      // Remove CSS links
      document
        .querySelectorAll(`link[data-plugin-id="${id}"]`)
        .forEach(el => el.remove());

      // Remove script tags
      document
        .querySelectorAll(`script[data-plugin-id="${id}"]`)
        .forEach(el => el.remove());

      if (__DEV__) {
        console.log(`[PluginManager] Removed resources for: ${id}`);
      }
    });
  }

  /** Whether a full page reload is required on next navigation */
  get needsReload() {
    return this[NEEDS_RELOAD];
  }

  /** @private */
  set needsReload(value) {
    this[NEEDS_RELOAD] = value;
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
   * Load a script and wait for it to finish executing.
   * Re-uses an existing SSR-injected <script> tag if present.
   * @param {string} url - Script URL
   * @param {string} pluginId - Plugin ID for tracking
   * @returns {Promise<void>}
   * @private
   */
  // eslint-disable-next-line class-methods-use-this
  _loadScript(url, pluginId) {
    return new Promise((resolve, reject) => {
      // Find by data-plugin-id (handles SSR scripts with different ?v= params)
      let script = document.querySelector(
        `script[data-plugin-id="${pluginId}"]`,
      );

      // Already present and fully loaded
      if (script && script.getAttribute('data-loaded')) {
        return resolve();
      }

      if (!script) {
        script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.setAttribute('data-plugin-id', pluginId);
        document.body.appendChild(script);
      }

      const cleanup = () => {
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onError);
      };
      const onLoad = () => {
        script.setAttribute('data-loaded', 'true');
        cleanup();
        resolve();
      };
      const onError = e => {
        cleanup();
        const error = new Error(`Failed to load script: ${url}`);
        error.code = 'SCRIPT_LOAD_FAILED';
        error.url = url;
        error.originalError = e;
        reject(error);
      };

      script.addEventListener('load', onLoad);
      script.addEventListener('error', onError);
    });
  }

  /**
   * Resolve the plugin entry point based on manifest
   * @param {Object} manifest - Plugin manifest
   * @returns {string|null} Entry point filename or null to skip
   */
  resolveEntryPoint(manifest) {
    // If the build produced a remote.js, load it as the Webpack MF container
    return manifest && manifest.hasClientScript ? 'remote.js' : null;
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

    const containerName = options && options.containerName;

    try {
      // Ensure shared scope is ready before loading any plugin
      // eslint-disable-next-line no-underscore-dangle
      await this._ensureReady();

      // If the MF container is not yet on window (SSR script hasn't
      // executed or was not injected), load the script dynamically.
      if (!window[containerName]) {
        const scriptUrl = this.getPluginAssetUrl(id, entryPoint);
        if (__DEV__) {
          console.log(
            `[ClientPluginManager] Container ${containerName} not on window, loading ${scriptUrl}`,
          );
        }
        // eslint-disable-next-line no-underscore-dangle
        await this._loadScript(scriptUrl, id);
      }

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

      if (__DEV__) {
        console.log(`[ClientPluginManager] Successfully loaded plugin: ${id}`);
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
    const manifest = data && data.manifest;

    switch (type) {
      case 'PLUGIN_INSTALLED':
      case 'PLUGIN_UPDATED':
        // Instantly inject CSS/script so user sees the effect
        await this.emit('plugin:loaded', { id: pluginId, manifest });
        this.needsReload = true;
        break;

      case 'PLUGIN_UNINSTALLED':
        // Remove CSS/script tags from the DOM
        await this.emit('plugin:unloaded', { id: pluginId });
        this.needsReload = true;
        break;

      case 'PLUGIN_ACTIVATED':
      case 'PLUGIN_DEACTIVATED':
        // No client-side action needed — Redux handles state updates
        break;

      default:
        console.warn(`[ClientPluginManager] Unknown event type: ${type}`);
    }
  }
}

// Export singleton instance
const pluginManager = new ClientPluginManager();

export default pluginManager;
