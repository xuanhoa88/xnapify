/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { removeNamespace } from '@shared/i18n/utils';

import {
  BaseExtensionManager,
  ACTIVE_EXTENSIONS,
  EXTENSION_METADATA,
  BUFFERED_ROUTES,
  STORED_ADAPTERS,
  CONNECTED_ROUTERS,
} from '../utils/BaseExtensionManager';
import { normalizeRouteAdapter } from '../utils/routeAdapter';

import { registry } from './Registry';

class ClientExtensionManager extends BaseExtensionManager {
  // ---------------------------------------------------------------------------
  // 1. Constructor
  // ---------------------------------------------------------------------------

  constructor() {
    super(registry);

    // Inject CSS and script tags when a extension is loaded at runtime
    this.on('extension:loaded', ({ id, manifest }) => {
      if (!manifest) return;

      const version = manifest.version || '0.0.0';

      // Inject extension.css
      if (manifest.hasClientCss) {
        if (!document.querySelector(`link[data-extension-id="${id}"]`)) {
          const url = this.getExtensionAssetUrl(
            id,
            `extension.css?v=${version}`,
          );
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          link.setAttribute('data-extension-id', id);
          document.head.appendChild(link);
          if (__DEV__) {
            console.log(`[ExtensionManager] Injected CSS: ${url}`);
          }
        }
      }

      // Inject remote.js (MF container)
      if (manifest.hasClientScript) {
        if (!document.querySelector(`script[data-extension-id="${id}"]`)) {
          const url = this.getExtensionAssetUrl(id, `remote.js?v=${version}`);
          const script = document.createElement('script');
          script.src = url;
          script.async = true;
          script.setAttribute('data-extension-id', id);
          document.body.appendChild(script);
          if (__DEV__) {
            console.log(`[ExtensionManager] Injected script: ${url}`);
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
  // 2. Subclass Hooks
  // ---------------------------------------------------------------------------

  /**
   * Resolve view context for lifecycle hooks.
   * Returns the view container (React app context).
   *
   * @returns {import('@shared/container').Container}
   */
  _hookContext() {
    return this.viewContainer;
  }

  /**
   * Eagerly activate namespaces for extensions so boot() runs
   * immediately — injecting Redux reducers, registering sidebar menus,
   * and registering slots for plugin-type extensions.
   * Server skips this (inherits no-op); SSR activates per-request via onRouteInit.
   */
  async _postLoad(id, ext, manifest) {
    const subs =
      manifest.rsk && Array.isArray(manifest.rsk.subscribe)
        ? manifest.rsk.subscribe
        : [];

    // Module-type extensions (with routes) auto-subscribe to '*' if no
    // explicit subscribe is declared (handled in Registry.defineExtension).
    // Plugin-type extensions (no routes) rely solely on their subscribe list.
    if (subs.length === 0) return;

    const results = await Promise.allSettled(
      subs.map(ns => this.ensureViewNamespaceActive(ns)),
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

  /**
   * Resolve the extension entry point based on manifest
   * @param {Object} manifest - Extension manifest
   * @returns {string|null} Entry point filename or null to skip
   */
  _resolveEntryPoint(manifest) {
    // If the build produced a remote.js, load it as the Webpack MF container
    return manifest && manifest.hasClientScript ? 'remote.js' : null;
  }

  // ---------------------------------------------------------------------------
  // 3. Module Loading
  // ---------------------------------------------------------------------------

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
   * Load extension module as MF remote container
   * @param {string} id - Extension ID
   * @param {string|null} entryPoint - Resolved entry point filename
   * @param {Object} manifest - Extension manifest
   * @param {Object} containerName - Container name
   */
  async _loadExtensionModule(id, entryPoint, manifest, containerName) {
    try {
      // If the MF container is not yet on window (SSR script hasn't
      // executed or was not injected), load the script dynamically.
      if (!window[containerName]) {
        const url = this.getExtensionAssetUrl(id, entryPoint);
        if (__DEV__) {
          console.log(
            `[ClientExtensionManager] Container ${containerName} not on window, loading ${url}`,
          );
        }
        // eslint-disable-next-line no-underscore-dangle
        await this._loadScript(url, id);
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

      if (__DEV__) {
        console.log(
          `[ClientExtensionManager] Successfully loaded extension: ${id}`,
        );
      }

      return ext;
    } catch (err) {
      console.error(
        `[ClientExtensionManager] Failed to load view module for ${id}:`,
        err.message,
      );
      this.emit('extension:error', {
        id,
        error: err,
        phase: 'view-module',
      });
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Route Management
  // ---------------------------------------------------------------------------

  /**
   * Normalize and inject (or buffer) view routes for an extension.
   * @param {string} id - Extension ID
   * @param {*} hookResult - Return value of the extension's views() hook
   * @param {'api'|'views'} [type='views'] - External route type (for normalizeRouteAdapter)
   */
  async _injectRoutes(id, hookResult, type = 'views') {
    const adapter = normalizeRouteAdapter(hookResult, type);
    const viewRouter = this[CONNECTED_ROUTERS]['views'];

    if (!viewRouter) {
      // Router not available yet — buffer with internal routerKey
      this[BUFFERED_ROUTES].push({ id, adapter, type: 'views' });
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
    const ctx = viewRouter._lastResolveContext;
    await viewRouter.add(adapter, ctx, id);

    if (!this[STORED_ADAPTERS].has(id)) {
      this[STORED_ADAPTERS].set(id, {});
    }
    this[STORED_ADAPTERS].get(id).views = adapter;

    if (__DEV__) {
      console.log(`[ClientExtensionManager] Injected view route(s) for ${id}`);
    }
  }

  /**
   * Inject buffered and stored extension view routes into the router.
   *
   * Called by views bootstrap after the router is created.
   * Overrides base to use client-specific add(adapter, ctx, sourceId) signature.
   *
   * @param {Object} viewRouter - The current view router instance
   */
  connectViewRouter(viewRouter) {
    // eslint-disable-next-line no-underscore-dangle
    this._connectRouter('views', viewRouter, (router, adapter, id) => {
      router.add(adapter, undefined, id);
      if (__DEV__) {
        console.log(`[ClientExtensionManager] Flushed view route(s) for ${id}`);
      }
    });
  }

  /**
   * Remove injected route adapters for an extension.
   * Delegates to base with client-specific string-based removal.
   * @param {string} id - Extension ID
   */
  async _removeRouteAdapters(id) {
    // Client uses string-based sourceId removal (survives HMR reference changes)
    // eslint-disable-next-line no-underscore-dangle
    await super._removeRouteAdapters(id, async (router, _adapter, extId) => {
      // eslint-disable-next-line no-underscore-dangle
      const ctx = router._lastResolveContext;
      await router.remove(extId, ctx);
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Refresh
  // ---------------------------------------------------------------------------

  /**
   * Targeted refresh: unload + reload specific extensions.
   * Triggers CSS/script tag removal (via extension:unloaded event),
   * then reloads from API with fresh manifests.
   *
   * @param {string[]} extensionIds - Extension IDs to refresh
   * @protected
   */
  async _refreshExtensions(extensionIds) {
    const resolvedIds = [
      ...new Set(extensionIds.filter(id => this[EXTENSION_METADATA].has(id))),
    ];

    if (resolvedIds.length === 0) {
      if (__DEV__) {
        console.log(
          `[ClientExtensionManager] refresh: no matching extensions for ${extensionIds.join(', ')}`,
        );
      }
      return;
    }

    if (__DEV__) {
      console.log(
        `[ClientExtensionManager] Refreshing: ${resolvedIds.join(', ')}`,
      );
    }

    await this.emit('extensions:refreshing', { extensionIds: resolvedIds });

    // Unload all targeted extensions (removes CSS/script tags via event)
    await Promise.all(
      resolvedIds.map(async id => {
        await this.unloadExtension(id);
        this[EXTENSION_METADATA].delete(id);
      }),
    );

    // Reload — each call fetches fresh manifest from API
    await Promise.allSettled(resolvedIds.map(id => this.loadExtension(id)));

    await this.emit('extensions:refreshed', { extensionIds: resolvedIds });

    if (__DEV__) {
      console.log('[ClientExtensionManager] Refreshed ✅');
    }
  }

  // ---------------------------------------------------------------------------
  // 6. WebSocket Event Handling
  // ---------------------------------------------------------------------------

  /**
   * Resolve the loaded ID for an extension.
   *
   * WebSocket events send the database UUID, but ACTIVE_EXTENSIONS is keyed
   * by package name (set during activateViewNamespace via registry.register).
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
    // Resolve UUID → package-name (routes/ACTIVE_EXTENSIONS use package-name)
    // eslint-disable-next-line no-underscore-dangle
    const loadedId = this._resolveLoadedId(id);
    if (!loadedId) return;

    // Phase 1: Shutdown hook
    const ext = this[ACTIVE_EXTENSIONS].get(loadedId);
    if (ext && typeof ext.shutdown === 'function') {
      try {
        // eslint-disable-next-line no-underscore-dangle
        await ext.shutdown(this._hookContext());
      } catch (error) {
        console.error(
          `[ClientExtensionManager] Failed to shutdown extension ${loadedId}:`,
          error,
        );
      }
    }

    // Phase 2: Translation cleanup
    removeNamespace(`extension:${loadedId}`);

    // Phase 3: Unregister from registry + remove routes + ACTIVE_EXTENSIONS
    await this.unloadExtension(loadedId);
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
        await this.reloadExtension(extensionId);
        break;
      }

      case 'EXTENSION_DEACTIVATED':
      case 'EXTENSION_UNINSTALLED': {
        // eslint-disable-next-line no-underscore-dangle
        await this._teardownExtension(extensionId);
        break;
      }

      case 'EXTENSION_ACTIVATED': {
        await this.loadExtension(extensionId, manifest);
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
