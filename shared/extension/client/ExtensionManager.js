/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  BaseExtensionManager,
  ACTIVE_EXTENSIONS,
  EXTENSION_METADATA,
  BUFFERED_ROUTES,
  STORED_ADAPTERS,
} from '../utils/BaseExtensionManager';
import { normalizeRouteAdapter } from '../utils/routeAdapter';

// Symbols — private (internal to client manager)
const VIEW_ROUTER = Symbol('__rsk.ext.viewRouter__');

class ClientExtensionManager extends BaseExtensionManager {
  constructor() {
    super();

    this[STORED_ADAPTERS] = new Map();
    this[BUFFERED_ROUTES] = [];
    this[VIEW_ROUTER] = null;

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

      if (__DEV__) {
        console.log(`[ExtensionManager] Removed resources for: ${id}`);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Post-load: eager namespace activation
  // ---------------------------------------------------------------------------

  /**
   * Eagerly activate namespaces for module-type extensions so boot() runs
   * immediately — injecting Redux reducers and registering sidebar menus.
   * Server skips this (inherits no-op); SSR activates per-request via onRouteInit.
   */
  async _postLoad(id, ext, manifest) {
    const hasRoutes = typeof ext.routes === 'function';
    if (!hasRoutes) return;

    const subs =
      manifest.rsk && Array.isArray(manifest.rsk.subscribe)
        ? manifest.rsk.subscribe
        : [];
    const results = await Promise.allSettled(
      subs.map(ns => this.ensureNamespaceActive(ns)),
    );
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        console.warn(
          `[ClientExtensionManager] Namespace "${subs[i]}" activation failed for ${id}:`,
          results[i].reason.message,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Route injection (mirrors ServerExtensionManager)
  // ---------------------------------------------------------------------------

  /**
   * Normalize and inject (or buffer) view routes for an extension.
   * @param {string} id - Extension ID
   * @param {*} hookResult - Return value of the extension's views() hook
   */
  async _injectRoutes(id, hookResult) {
    const adapter = normalizeRouteAdapter(hookResult, 'views');

    if (!this[VIEW_ROUTER]) {
      // Router not available yet — buffer for later injection
      this[BUFFERED_ROUTES].push({ id, adapter });
      if (__DEV__) {
        console.log(
          `[ClientExtensionManager] Buffered view route(s) for ${id} (router not ready)`,
        );
      }
      return;
    }

    // Pass _lastResolveContext so register() lifecycle fires immediately
    // Pass id as sourceId for robust removal (survives HMR reference changes)
    // eslint-disable-next-line no-underscore-dangle
    const ctx = this[VIEW_ROUTER]._lastResolveContext;
    await this[VIEW_ROUTER].add(adapter, ctx, id);

    if (!this[STORED_ADAPTERS].has(id)) {
      this[STORED_ADAPTERS].set(id, {});
    }
    this[STORED_ADAPTERS].get(id).view = adapter;

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
   * @param {Object} viewRouter - The current view router instance
   */
  connectViewRouter(viewRouter) {
    // Store the view router reference for future use
    this[VIEW_ROUTER] = viewRouter;

    // 1. Process pending injections (buffer → store)
    const pending = this[BUFFERED_ROUTES].splice(0);
    for (const { id, adapter } of pending) {
      if (!this[STORED_ADAPTERS].has(id)) {
        this[STORED_ADAPTERS].set(id, {});
      }
      this[STORED_ADAPTERS].get(id).view = adapter;
    }

    if (!viewRouter) {
      if (__DEV__) {
        console.warn(
          '[ClientExtensionManager] viewRouter unavailable for flush',
        );
      }
      return;
    }

    // 2. Inject all stored view adapters into the current router
    for (const [id, adapters] of this[STORED_ADAPTERS].entries()) {
      if (!adapters.view) continue;

      viewRouter.add(adapters.view, undefined, id);
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
  async _removeRouteAdapters(id) {
    if (this[VIEW_ROUTER]) {
      // Use string-based sourceId removal (survives HMR/reference changes)
      // eslint-disable-next-line no-underscore-dangle
      const ctx = this[VIEW_ROUTER]._lastResolveContext;
      await this[VIEW_ROUTER].remove(id, ctx);
    }

    // Clean up adapter reference if still stored
    this[STORED_ADAPTERS].delete(id);

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
   * Environment-specific setup called once by init().
   * Verifies Module Federation shared scope and sets up dev debug.
   */
  _onInit() {
    try {
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
    } catch (error) {
      console.error('[ClientExtensionManager] Failed to initialize:', error);
    }
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
  _resolveEntryPoint(manifest) {
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
    const containerName = options && options.containerName;

    try {
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
        await this._injectViewRoutes(id, ext, manifest);
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
   * Resolve the loaded ID for an extension.
   *
   * WebSocket events send the database UUID, but ACTIVE_EXTENSIONS is keyed
   * by package name (set during activateNamespace via registry.register).
   * This helper tries the UUID first, then resolves the package name via
   * extension metadata.
   *
   * @param {string} id - Database UUID from WebSocket event
   * @returns {string|null} The key in ACTIVE_EXTENSIONS, or null
   * @private
   */
  _resolveLoadedId(id) {
    if (this.isExtensionLoaded(id)) return id;
    const meta = this[EXTENSION_METADATA].get(id);
    const pkgName =
      meta && meta.manifest && meta.manifest.name ? meta.manifest.name : null;
    if (pkgName && this.isExtensionLoaded(pkgName)) return pkgName;
    return null;
  }

  /**
   * Full teardown of an extension: remove routes, unload, and clean up.
   * Handles the UUID vs package-name ID mismatch transparently.
   *
   * @param {string} id - Database UUID from WebSocket event
   * @private
   */
  async _teardownExtension(id) {
    // eslint-disable-next-line no-underscore-dangle
    await this._removeRouteAdapters(id);

    // eslint-disable-next-line no-underscore-dangle
    const loadedId = this._resolveLoadedId(id);
    if (loadedId) {
      await this.unloadExtension(loadedId);
    }
  }

  /**
   * Process an extension lifecycle event (install, activate, deactivate, etc.)
   * @param {Object} event - Event with { type, extensionId, data }
   */
  async processLifecycleEvent(event) {
    if (!event || !event.type) {
      console.warn('[ClientExtensionManager] Invalid event received:', event);
      return;
    }

    const { type, extensionId, data } = event;
    const manifest = data && data.manifest;

    switch (type) {
      case 'EXTENSION_INSTALLED':
      case 'EXTENSION_UPDATED': {
        await this.emit('extension:loaded', { id: extensionId, manifest });
        await this.reloadExtension(extensionId);
        break;
      }

      case 'EXTENSION_UNINSTALLED': {
        // eslint-disable-next-line no-underscore-dangle
        await this._teardownExtension(extensionId);
        await this.emit('extension:unloaded', { id: extensionId });
        break;
      }

      case 'EXTENSION_ACTIVATED': {
        await this.loadExtension(extensionId, manifest);
        break;
      }

      case 'EXTENSION_DEACTIVATED': {
        // eslint-disable-next-line no-underscore-dangle
        await this._teardownExtension(extensionId);
        break;
      }

      case 'EXTENSIONS_REFRESHED': {
        await this.refresh();
        break;
      }

      default:
        console.warn(`[ClientExtensionManager] Unknown event type: ${type}`);
    }
  }
}

// Export singleton instance
const extensionManager = new ClientExtensionManager();

export default extensionManager;
