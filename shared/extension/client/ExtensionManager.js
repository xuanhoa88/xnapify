/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { removeNamespace } from '@shared/i18n/utils.js';

import {
  BaseExtensionManager,
  ACTIVE_EXTENSIONS,
  EXTENSION_METADATA,
} from '../utils/BaseExtensionManager.js';
import { isDeferrableExtension } from '../utils/deferral.js';
import { normalizeRouteAdapter } from '../utils/routeAdapter.js';

import { registry } from './Registry.js';

/** @type {symbol} id → manifest of extensions whose download is deferred */
const DEFERRED = Symbol('__xnapify.ext.deferred__');

class ClientExtensionManager extends BaseExtensionManager {
  // ---------------------------------------------------------------------------
  // 1. Constructor
  // ---------------------------------------------------------------------------

  constructor() {
    super(registry);
    this[DEFERRED] = new Map();

    this.refreshingIds = new Set();

    this.on('extensions:refreshing', ({ extensionIds }) => {
      extensionIds.forEach(id => this.refreshingIds.add(id));
    });

    this.on('extensions:refreshed', ({ extensionIds }) => {
      extensionIds.forEach(id => this.refreshingIds.delete(id));
    });

    // Inject CSS and script tags when a extension is loaded at runtime
    this.on('extension:loaded', ({ id, manifest }) => {
      if (!manifest) return;

      const bm = manifest.buildManifest || {};

      // Inject extension.css (content-hashed filename from buildManifest)
      if (manifest.hasClientCss) {
        const cssFile = bm['extension.css'] || 'extension.css';
        const url = this.getExtensionAssetUrl(id, cssFile);
        const existingLink = document.querySelector(
          `link[data-extension-id="${id}"][href="${url}"]`,
        );

        if (!existingLink) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          link.setAttribute('data-extension-id', id);

          const cleanupStale = () => {
            document
              .querySelectorAll(
                `link[data-extension-id="${id}"][data-extension-stale="true"]`,
              )
              .forEach(el => el.remove());
          };
          link.onload = cleanupStale;
          // A failed sheet fires `error` once, possibly before anything is
          // listening. Record it on the element so `_settleStylesheet` can
          // give up at once instead of waiting out its timeout.
          link.onerror = () => {
            link.setAttribute('data-extension-css-error', 'true');
            console.error(
              `[ExtensionManager] Failed to load stylesheet for ${id}: ${url}`,
            );
            cleanupStale();
          };

          document.head.appendChild(link);
          if (__DEV__) {
            console.log(`[ExtensionManager] Injected CSS: ${url}`);
          }
        } else {
          existingLink.removeAttribute('data-extension-stale');
          document
            .querySelectorAll(
              `link[data-extension-id="${id}"][data-extension-stale="true"]`,
            )
            .forEach(el => el.remove());
        }
      } else {
        document
          .querySelectorAll(
            `link[data-extension-id="${id}"][data-extension-stale="true"]`,
          )
          .forEach(el => el.remove());
      }

      // Inject remote.js (MF container, content-hashed filename)
      if (manifest.hasClientScript) {
        const scriptFile = bm['remote.js'] || 'remote.js';
        const url = this.getExtensionAssetUrl(id, scriptFile);
        const existingScript = document.querySelector(
          `script[data-extension-id="${id}"][src="${url}"]`,
        );

        if (!existingScript) {
          const script = document.createElement('script');
          script.src = url;
          script.async = true;
          script.setAttribute('data-extension-id', id);

          const cleanupStale = () => {
            document
              .querySelectorAll(
                `script[data-extension-id="${id}"][data-extension-stale="true"]`,
              )
              .forEach(el => el.remove());
          };
          script.onload = cleanupStale;
          script.onerror = cleanupStale;

          document.body.appendChild(script);
          if (__DEV__) {
            console.log(`[ExtensionManager] Injected script: ${url}`);
          }
        } else {
          existingScript.removeAttribute('data-extension-stale');
          document
            .querySelectorAll(
              `script[data-extension-id="${id}"][data-extension-stale="true"]`,
            )
            .forEach(el => el.remove());
        }
      } else {
        document
          .querySelectorAll(
            `script[data-extension-id="${id}"][data-extension-stale="true"]`,
          )
          .forEach(el => el.remove());
      }
    });

    // Remove CSS and script tags when an extension is unloaded at runtime
    this.on('extension:unloaded', ({ id }) => {
      if (this.refreshingIds.has(id)) {
        document
          .querySelectorAll(`link[data-extension-id="${id}"]`)
          .forEach(el => el.setAttribute('data-extension-stale', 'true'));
        document
          .querySelectorAll(`script[data-extension-id="${id}"]`)
          .forEach(el => el.setAttribute('data-extension-stale', 'true'));
      } else {
        // Remove CSS links
        document
          .querySelectorAll(`link[data-extension-id="${id}"]`)
          .forEach(el => el.remove());

        // Remove script tags
        document
          .querySelectorAll(`script[data-extension-id="${id}"]`)
          .forEach(el => el.remove());

        if (__DEV__) {
          console.log(
            `[ExtensionManager] Removed resources for: ${this._formatDisplayName(id)}`,
          );
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Subclass Hooks
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Deferred loading
  // ---------------------------------------------------------------------------

  /**
   * Whether an extension's remote bundle can wait until one of its
   * namespaces activates.
   *
   * Only slot-only extensions qualify: an extension that contributes routes
   * must be present before hydration, and a wildcard subscriber is needed on
   * every page. `hasRoutes` is stamped by the server after it has loaded the
   * extension; without that signal the extension loads eagerly (safe default).
   *
   * @param {Object|null} manifest
   * @returns {boolean}
   */
  static shouldDefer(manifest) {
    return isDeferrableExtension(manifest);
  }

  /**
   * Load an extension, or park it until a namespace it subscribes to is
   * activated by the router (`activateViewNamespace`).
   *
   * @param {string} id
   * @param {Object|null} [manifest]
   * @param {Set} [_loadingChain]
   * @param {{ immediate?: boolean }} [options]
   */
  async loadExtension(id, manifest = null, _loadingChain, options = {}) {
    const immediate = options && options.immediate === true;
    if (
      !immediate &&
      !this[ACTIVE_EXTENSIONS].has(id) &&
      ClientExtensionManager.shouldDefer(manifest)
    ) {
      this[DEFERRED].set(id, manifest);
      if (__DEV__) {
        console.log(
          `[ClientExtensionManager] Deferred ${this._formatDisplayName(id, manifest)} until namespace: ${manifest.slots.join(', ')}`,
        );
      }
      return null;
    }
    const wasDeferred = this[DEFERRED].delete(id);
    const loaded = await super.loadExtension(id, manifest, _loadingChain);

    // An extension that was parked has its stylesheet injected as it loads,
    // and the router renders its slots the moment activation returns. Wait
    // for the sheet to apply first, or the panel paints unstyled for a few
    // frames. Bounded and best-effort: a stylesheet that never arrives must
    // not hold up a navigation.
    // eslint-disable-next-line no-underscore-dangle
    if (wasDeferred) await this._settleStylesheet(id);

    return loaded;
  }

  /**
   * Resolve once an extension's stylesheet has applied, or give up.
   *
   * A sheet already in the document — injected by an earlier load, or emitted
   * by the server for a page that renders this extension's slots — exposes
   * `link.sheet` and resolves immediately.
   *
   * @param {string} id - Extension ID
   * @param {number} [timeout=2000] - Milliseconds to wait before giving up
   * @returns {Promise<void>}
   * @private
   */
  _settleStylesheet(id, timeout = 2000) {
    if (typeof document === 'undefined') return Promise.resolve();

    const link = document.querySelector(
      `link[data-extension-id="${id}"]:not([data-extension-stale="true"])`,
    );
    if (!link) return Promise.resolve();

    // The sheet already failed: `error` fired before this ran and will not
    // fire again, so waiting would burn the whole timeout on a navigation.
    if (link.getAttribute('data-extension-css-error') === 'true') {
      return Promise.resolve();
    }

    try {
      if (link.sheet) return Promise.resolve();
    } catch {
      // Unreadable sheet — same-origin here, but never block on the answer
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const done = () => {
        clearTimeout(timer);
        link.removeEventListener('load', done);
        link.removeEventListener('error', done);
        resolve();
      };
      const fail = () => {
        link.setAttribute('data-extension-css-error', 'true');
        console.error(
          `[ExtensionManager] Failed to load stylesheet for ${id}: ${link.href}`,
        );
        done();
      };
      const timer = setTimeout(done, timeout);
      link.addEventListener('load', done);
      link.addEventListener('error', fail);
    });
  }

  /**
   * Download every deferred extension subscribed to a namespace, then run
   * the regular activation.
   *
   * @param {string} ns
   */
  async activateViewNamespace(ns) {
    const pending = [];
    for (const [id, manifest] of this[DEFERRED]) {
      if (Array.isArray(manifest.slots) && manifest.slots.includes(ns)) {
        pending.push([id, manifest]);
      }
    }
    if (pending.length > 0) {
      await Promise.allSettled(
        pending.map(([id, manifest]) =>
          this.loadExtension(id, manifest, undefined, { immediate: true }),
        ),
      );
    }
    return super.activateViewNamespace(ns);
  }

  /**
   * Forget a deferred extension on unload so a later activation does not
   * resurrect it.
   *
   * @param {string} id
   */
  async unloadExtension(id) {
    this[DEFERRED].delete(id);
    return super.unloadExtension(id);
  }

  /**
   * Drop the parked manifests along with the base state. They are never
   * unloaded (they were never loaded), so nothing else clears them and a
   * destroyed manager would keep them — and resurrect them on the next
   * namespace activation.
   */
  async destroy() {
    await super.destroy();
    this[DEFERRED].clear();
  }

  /**
   * Resolve view context for lifecycle hooks.
   * Returns the view container (React app context).
   *
   * @returns {import('@shared/container/index.js').Container}
   */
  _hookContext() {
    return this.viewContainer;
  }

  /**
   * Resolve the extension entry point based on manifest
   * @param {Object} manifest - Extension manifest
   * @returns {string|null} Entry point filename or null to skip
   */
  _resolveEntryPoint(manifest) {
    // If the build produced a remote.js, load it as the Rspack MF container
    // Resolve the hashed filename from buildManifest
    if (manifest && manifest.hasClientScript) {
      const bm = manifest.buildManifest;
      return (bm && bm['remote.js']) || 'remote.js';
    }
    return null;
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
        script.setAttribute('data-extension-injected', 'true');
        document.body.appendChild(script);
      } else if (
        !script.hasAttribute('data-extension-injected') &&
        document.readyState !== 'loading'
      ) {
        // A tag the server put in the page. Those are `defer`, so they have
        // all run by the time parsing finishes — this one either defined its
        // container (the caller checks that first and would not be here) or
        // it failed, and its `error` event fired long before we could listen
        // for it. Waiting would hang the activation, and with it the resolve
        // that renders the page, forever.
        const error = new Error(`Failed to load script: ${url}`);
        error.code = 'SCRIPT_LOAD_FAILED';
        error.url = url;
        return reject(error);
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

    // Ensure the shared scope is initialized (required for Rspack/Webpack MF in eager setups)
    if (typeof __webpack_init_sharing__ !== 'undefined') {
      // eslint-disable-next-line no-undef
      await __webpack_init_sharing__('default');
    }

    // Verify shared scope is available
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
          `[ClientExtensionManager] Successfully loaded extension: ${this._formatDisplayName(id, manifest)}`,
        );
      }

      return ext;
    } catch (err) {
      console.error(
        `[ClientExtensionManager] Failed to load view module for ${this._formatDisplayName(id, manifest)}:`,
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
    const viewRouter = this.routes.routerFor('views');

    if (!viewRouter) {
      // Router not available yet — buffer with internal routerKey
      this.routes.buffer(id, adapter, 'views');
      if (__DEV__) {
        console.log(
          `[ClientExtensionManager] Buffered view route(s) for ${this._formatDisplayName(id)} (router not ready)`,
        );
      }
      return;
    }

    // Pass _lastResolveContext so register() lifecycle fires immediately
    // Pass id as sourceId for robust removal (survives HMR reference changes)
    // eslint-disable-next-line no-underscore-dangle
    const ctx = viewRouter._lastResolveContext;
    await viewRouter.add(adapter, ctx, id);

    this.routes.store(id, adapter, 'views');

    if (__DEV__) {
      console.log(
        `[ClientExtensionManager] Injected view route(s) for ${this._formatDisplayName(id)}`,
      );
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
        console.log(
          `[ClientExtensionManager] Flushed view route(s) for ${this._formatDisplayName(id)}`,
        );
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
  // 5. Reload Overrides
  // ---------------------------------------------------------------------------

  /**
   * Reload an extension by ID.
   * Overridden to deduplicate identical concurrent fetch requests.
   *
   * @param {string} id - Extension ID
   * @returns {Promise<any>}
   */
  async reloadExtension(id) {
    if (!this.pendingReloads) {
      this.pendingReloads = new Map();
    }

    if (this.pendingReloads.has(id)) {
      if (__DEV__) {
        console.log(
          `[ClientExtensionManager] Deduplicating reload request for: ${id}`,
        );
      }
      return this.pendingReloads.get(id);
    }

    const reloadPromise = super.reloadExtension(id);
    this.pendingReloads.set(id, reloadPromise);

    try {
      return await reloadPromise;
    } finally {
      this.pendingReloads.delete(id);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Refresh
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
   * Resolve the internal loaded ID for an extension.
   * Handles mismatch between WS event IDs (manifest.name) and internal
   * map keys (manifest.id = build-time hashids ID).
   *
   * @param {string} id - Extension identifier (DB key or manifest.name)
   * @returns {string|null}
   * @private
   */
  _resolveLoadedId(id) {
    if (this.isExtensionLoaded(id)) return id;

    const meta = this[EXTENSION_METADATA].get(id);
    if (meta) {
      const pkgName =
        meta.manifest && meta.manifest.name ? meta.manifest.name : null;
      if (pkgName && this.isExtensionLoaded(pkgName)) return pkgName;
    }

    for (const [internalId, m] of this[EXTENSION_METADATA].entries()) {
      if (m.manifest && m.manifest.name === id) {
        if (this.isExtensionLoaded(internalId)) return internalId;
      }
    }

    return null;
  }

  /**
   * Full teardown: shutdown hook → translation cleanup → unload.
   * @param {string} id - Extension ID from WebSocket event
   * @private
   */
  async _teardownExtension(id) {
    // eslint-disable-next-line no-underscore-dangle
    const loadedId = this._resolveLoadedId(id);
    if (!loadedId) return;

    const ext = this[ACTIVE_EXTENSIONS].get(loadedId);
    if (ext && typeof ext.shutdown === 'function') {
      try {
        await ext.shutdown({
          // eslint-disable-next-line no-underscore-dangle
          ...this._hookContextFor(loadedId),
          // eslint-disable-next-line no-underscore-dangle
          registry: this._scopedRegistry(loadedId),
        });
      } catch (error) {
        console.error(
          `[ClientExtensionManager] Failed to shutdown extension ${loadedId}:`,
          error,
        );
      }
    }

    const meta = this[EXTENSION_METADATA].get(loadedId);
    removeNamespace(
      (meta && meta.translationNamespace) || `extension:${loadedId}`,
    );
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
