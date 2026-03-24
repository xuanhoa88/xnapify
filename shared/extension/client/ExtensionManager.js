/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */



import { normalizeRouteAdapter } from '@shared/utils/routeAdapter';

import {
  BaseExtensionManager,
  ACTIVE_EXTENSIONS,
  EXTENSION_CONTEXT,
  EXTENSION_METADATA,
  EXTENSION_INIT,
} from '../utils/BaseExtensionManager';

// Private symbols
const NEEDS_RELOAD = Symbol('__rsk.needsReloadExtensions__');
const EXTENSION_ROUTE_ADAPTERS = Symbol('__rsk.extensionRouteAdapters__');
const PENDING_ROUTE_INJECTIONS = Symbol('__rsk.pendingRouteInjections__');

class ClientExtensionManager extends BaseExtensionManager {
  constructor() {
    super();

    this[NEEDS_RELOAD] = false;
    this[EXTENSION_ROUTE_ADAPTERS] = new Map();
    this[PENDING_ROUTE_INJECTIONS] = [];

    // Inject CSS and script tags when a extension is loaded at runtime
    this.on('extension:loaded', ({ id, manifest }) => {
      if (!manifest) return;

      const version = manifest.version || '0.0.0';

      // Inject extension.css
      if (manifest.hasClientCss) {
        if (!document.querySelector(`link[data-extension-id="${id}"]`)) {
          const href = this.getExtensionAssetUrl(
            id,
            `extension.css?v=${version}`,
          );
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          link.setAttribute('data-extension-id', id);
          document.head.appendChild(link);
          if (__DEV__) {
            console.log(`[ExtensionManager] Injected CSS: ${href}`);
          }
        }
      }

      // Inject remote.js (MF container)
      if (manifest.hasClientScript) {
        if (!document.querySelector(`script[data-extension-id="${id}"]`)) {
          const src = this.getExtensionAssetUrl(id, `remote.js?v=${version}`);
          const script = document.createElement('script');
          script.src = src;
          script.async = true;
          script.setAttribute('data-extension-id', id);
          document.body.appendChild(script);
          if (__DEV__) {
            console.log(`[ExtensionManager] Injected script: ${src}`);
          }
        }
      }
    });

    // Remove CSS and script tags when an extension is unloaded at runtime
    this.on('extension:unloaded', ({ id }) => {
      // Remove CSS links
      document
        .querySelectorAll(`link[data-extension-id="${id}"]`)
        .forEach(el => el.remove());

      // Remove script tags
      document
        .querySelectorAll(`script[data-extension-id="${id}"]`)
        .forEach(el => el.remove());

      // Remove injected view routes
      // eslint-disable-next-line no-underscore-dangle
      this._removeRouteAdapters(id);

      if (__DEV__) {
        console.log(`[ExtensionManager] Removed resources for: ${id}`);
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

  // ---------------------------------------------------------------------------
  // Route injection (mirrors ServerExtensionManager)
  // ---------------------------------------------------------------------------

  /**
   * Resolve the view router from the DI container.
   * @returns {Object|null} Router instance or null
   * @private
   */
  _resolveRouter() {
    const ctx = this[EXTENSION_CONTEXT];
    try {
      return ctx.container.resolve('viewRouter');
    } catch {
      return null;
    }
  }

  /**
   * Normalize and inject (or buffer) view routes for an extension.
   * @param {string} id - Extension ID
   * @param {*} hookResult - Return value of the extension's views() hook
   * @private
   */
  _injectRoutes(id, hookResult) {
    const adapter = normalizeRouteAdapter(hookResult, 'views');
    // eslint-disable-next-line no-underscore-dangle
    const router = this._resolveRouter();

    if (!router) {
      // Router not available yet — buffer for later injection
      this[PENDING_ROUTE_INJECTIONS].push({ id, adapter });
      if (__DEV__) {
        console.log(
          `[ClientExtensionManager] Buffered view route(s) for ${id} (router not ready)`,
        );
      }
      return;
    }

    router.add(adapter);

    if (!this[EXTENSION_ROUTE_ADAPTERS].has(id)) {
      this[EXTENSION_ROUTE_ADAPTERS].set(id, {});
    }
    this[EXTENSION_ROUTE_ADAPTERS].get(id).view = adapter;

    if (__DEV__) {
      console.log(`[ClientExtensionManager] Injected view route(s) for ${id}`);
    }
  }

  /**
   * Inject buffered and stored extension view routes into the router.
   *
   * Called by views bootstrap after the router is created. Handles:
   * 1. Pending injections buffered before the router was ready
   * 2. Re-injection of already-stored adapters (e.g. on HMR/SSR)
   *
   * @param {Object} [viewRouter] - The current view router instance
   */
  flushPendingRoutes(viewRouter) {
    // 1. Process pending injections (buffer → store)
    const pending = this[PENDING_ROUTE_INJECTIONS].splice(0);
    for (const { id, adapter } of pending) {
      if (!this[EXTENSION_ROUTE_ADAPTERS].has(id)) {
        this[EXTENSION_ROUTE_ADAPTERS].set(id, {});
      }
      this[EXTENSION_ROUTE_ADAPTERS].get(id).view = adapter;
    }

    // 2. Resolve the router (prefer explicit param over container lookup)
    // eslint-disable-next-line no-underscore-dangle
    const router = viewRouter || this._resolveRouter();
    if (!router) {
      if (__DEV__) {
        console.warn(
          '[ClientExtensionManager] viewRouter unavailable for flush',
        );
      }
      return;
    }

    // 3. Inject all stored view adapters into the current router
    for (const [id, adapters] of this[EXTENSION_ROUTE_ADAPTERS].entries()) {
      if (!adapters.view) continue;

      router.add(adapters.view);
      if (__DEV__) {
        console.log(`[ClientExtensionManager] Flushed view route(s) for ${id}`);
      }
    }
  }

  /**
   * Remove injected route adapters for an extension.
   * @param {string} id - Extension ID
   * @private
   */
  _removeRouteAdapters(id) {
    const adapters = this[EXTENSION_ROUTE_ADAPTERS].get(id);
    if (!adapters || !adapters.view) return;

    // eslint-disable-next-line no-underscore-dangle
    const router = this._resolveRouter();
    if (router) {
      router.remove(adapters.view);
    }

    this[EXTENSION_ROUTE_ADAPTERS].delete(id);

    if (__DEV__) {
      console.log(`[ClientExtensionManager] Removed route adapters for: ${id}`);
    }
  }

  /**
   * Initialize Module Federation container
   * @param {Object} container - MF container
   * @param {string} containerName - Container name
   * @returns {Promise<void>}
   */
  async _initializeContainer(container, containerName) {
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
        `[ClientExtensionManager] Initialized container: ${containerName}`,
      );
    }
  }

  /**
   * Get module from container
   * @param {Object} container - MF container
   * @returns {Promise<Object>} Module
   */
  async _getContainerModule(container) {
    const factory = await container.get('./extension');
    return factory();
  }

  /**
   * Ensure Module Federation shared scope is initialized.
   * The shared scope is available as soon as Webpack's client bundle
   * executes, so no additional waiting is required.
   * @returns {Promise<void>}
   */
  async _ensureReady() {
    if (this[EXTENSION_INIT]) {
      return this[EXTENSION_INIT];
    }

    this[EXTENSION_INIT] = (async () => {
      // Verify shared scope is available
      // eslint-disable-next-line no-undef
      if (
        typeof __webpack_share_scopes__ === 'undefined' ||
        // eslint-disable-next-line no-undef
        !__webpack_share_scopes__.default
      ) {
        console.warn(
          '[ClientExtensionManager] Module Federation shared scope not found.',
        );
      } else if (__DEV__) {
        console.log(
          '[ClientExtensionManager] Module Federation ready for extensions',
        );
      }

      // Expose debug inspector in dev mode
      if (__DEV__) {
        // eslint-disable-next-line no-underscore-dangle
        window.__RSK_EXTENSION_DEBUG__ = {
          registry: this.registry,
          metadata: this[EXTENSION_METADATA],
          active: this[ACTIVE_EXTENSIONS],
          manager: this,
        };
      }
    })();

    return this[EXTENSION_INIT];
  }

  /**
   * Load a script and wait for it to finish executing.
   * Re-uses an existing SSR-injected <script> tag if present.
   * @param {string} url - Script URL
   * @param {string} extensionId - Extension ID for tracking
   * @returns {Promise<void>}
   * @private
   */
  // eslint-disable-next-line class-methods-use-this
  _loadScript(url, extensionId) {
    return new Promise((resolve, reject) => {
      // Find by data-extension-id (handles SSR scripts with different ?v= params)
      let script = document.querySelector(
        `script[data-extension-id="${extensionId}"]`,
      );

      // Already present and fully loaded
      if (script && script.getAttribute('data-loaded')) {
        return resolve();
      }

      if (!script) {
        script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.setAttribute('data-extension-id', extensionId);
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
   * Resolve the extension entry point based on manifest
   * @param {Object} manifest - Extension manifest
   * @returns {string|null} Entry point filename or null to skip
   */
  resolveEntryPoint(manifest) {
    // If the build produced a remote.js, load it as the Webpack MF container
    return manifest && manifest.hasClientScript ? 'remote.js' : null;
  }

  /**
   * Load extension module as MF remote container
   * @param {string} id - Extension ID
   * @param {string|null} entryPoint - Resolved entry point filename
   * @param {Object} manifest - Extension manifest
   * @param {Object} options - Additional options (containerName)
   */
  async _bootstrapExtension(id, entryPoint, manifest, options) {
    // Skip if no entry point resolved (e.g. server-only extension)
    if (!entryPoint) {
      if (__DEV__) {
        console.log(
          `[ClientExtensionManager] Skipping extension ${id} (no client entry point)`,
        );
      }
      return null;
    }

    const containerName = options && options.containerName;

    try {
      // Ensure shared scope is ready before loading any extension
      // eslint-disable-next-line no-underscore-dangle
      await this._ensureReady();

      // If the MF container is not yet on window (SSR script hasn't
      // executed or was not injected), load the script dynamically.
      if (!window[containerName]) {
        const scriptUrl = this.getExtensionAssetUrl(id, entryPoint);
        if (__DEV__) {
          console.log(
            `[ClientExtensionManager] Container ${containerName} not on window, loading ${scriptUrl}`,
          );
        }
        // eslint-disable-next-line no-underscore-dangle
        await this._loadScript(scriptUrl, id);
      }

      const container = window[containerName];
      if (!container) {
        const error = new Error(
          `Extension container ${containerName} not found on window after script loaded`,
        );
        error.code = 'CONTAINER_NOT_FOUND';
        error.containerName = containerName;
        throw error;
      }

      // Initialize the container with the host's shared scope
      // eslint-disable-next-line no-underscore-dangle
      await this._initializeContainer(container, containerName);

      // Get the exposed extension module
      // eslint-disable-next-line no-underscore-dangle
      const extensionModule = await this._getContainerModule(container);
      const ext = extensionModule.default || extensionModule;

      // Inject view routes if the extension provides a views() hook
      try {
        // eslint-disable-next-line no-underscore-dangle
        this._injectViewRoutes(id, ext, manifest);
      } catch (err) {
        console.error(
          `[ClientExtensionManager] Failed to inject view routes for ${id}:`,
          err.message,
        );
      }

      if (__DEV__) {
        console.log(
          `[ClientExtensionManager] Successfully loaded extension: ${id}`,
        );
      }

      return ext;
    } catch (err) {
      // Enhanced error with full context for debugging
      const error = new Error(
        `Failed to load extension "${id}": ${err.message}`,
      );
      error.code = err.code || 'EXTENSION_LOAD_FAILED';
      error.extensionId = id;
      error.containerName = containerName;
      error.originalError = err;

      console.error(`[ClientExtensionManager] ${error.message}`, {
        extensionId: id,
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
  onReady() {
    console.log('[ClientExtensionManager] Ready to receive WebSocket events');
  }

  /**
   * Handle external event (e.g., from WebSocket)
   * @param {Object} event - Event object
   */
  async onWebSocketEvent(event) {
    if (!event || !event.type) {
      console.warn('[ClientExtensionManager] Invalid event received:', event);
      return;
    }

    const { type, extensionId, data } = event;
    const manifest = data && data.manifest;

    switch (type) {
      case 'EXTENSION_INSTALLED':
      case 'EXTENSION_UPDATED': {
        // Instantly inject CSS/script so user sees the effect
        await this.emit('extension:loaded', { id: extensionId, manifest });
        this.needsReload = true;
        break;
      }

      case 'EXTENSION_UNINSTALLED': {
        // Remove CSS/script tags from the DOM
        await this.emit('extension:unloaded', { id: extensionId });
        this.needsReload = true;
        break;
      }

      case 'EXTENSION_ACTIVATED':
      case 'EXTENSION_DEACTIVATED':
        // Reload needed so new routes/menus are picked up
        this.needsReload = true;
        break;

      default:
        console.warn(`[ClientExtensionManager] Unknown event type: ${type}`);
    }
  }
}

// Export singleton instance
const extensionManager = new ClientExtensionManager();

export default extensionManager;
