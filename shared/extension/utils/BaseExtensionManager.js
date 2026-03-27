/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Base Extension Manager
 * Handles dynamic loading, unloading, and synchronization of extensions.
 * Shared logic for both server and client.
 */

import { getTranslations } from '@shared/i18n/loader';
import { addNamespace, removeNamespace } from '@shared/i18n/utils';
import { LIFECYCLE_HOOKS } from '@shared/utils/lifecycle';

// Symbols — exported (used by subclass managers and tests)
export const ACTIVE_EXTENSIONS = Symbol('__rsk.ext.active__');
export const EXTENSION_METADATA = Symbol('__rsk.ext.metadata__');
export const BUFFERED_ROUTES = Symbol('__rsk.ext.pendingRoutes__');
export const STORED_ADAPTERS = Symbol('__rsk.ext.routeAdapters__');
export const CONNECTED_ROUTERS = Symbol('__rsk.ext.connectedRouters__');

// Symbols — private (internal to base manager)
const FETCH = Symbol('__rsk.ext.fetch__');
const CONTEXTS = Symbol('__rsk.ext.contexts__');
const REGISTRY = Symbol('__rsk.ext.registry__');
const EVENT_HANDLERS = Symbol('__rsk.ext.eventHandlers__');

/**
 * Extension states
 */
export const ExtensionState = Object.freeze({
  PENDING: 'pending',
  LOADING: 'loading',
  LOADED: 'loaded',
  ACTIVE: 'active',
  FAILED: 'failed',
  UNLOADING: 'unloading',
  UNLOADED: 'unloaded',
});

/**
 * Extension metadata structure
 * @typedef {Object} ExtensionMetadata
 * @property {string} id - Extension identifier
 * @property {string} state - Current extension state
 * @property {string} version - Extension version
 * @property {Error|null} error - Last error if any
 * @property {number} loadedAt - Timestamp when loaded
 * @property {Object<string, string>} require - Extension dependencies
 * @property {Object} manifest - Full extension manifest
 */

export class BaseExtensionManager {
  // ---------------------------------------------------------------------------
  // 1. Constructor
  // ---------------------------------------------------------------------------

  /**
   * @param {ExtensionRegistry} registryInstance - Environment-specific registry
   */
  constructor(registryInstance) {
    if (!registryInstance) {
      throw new Error('BaseExtensionManager requires a registry instance');
    }
    this[REGISTRY] = registryInstance;
    this[FETCH] = null;
    this[ACTIVE_EXTENSIONS] = new Map(); // id -> extension instance
    this[EXTENSION_METADATA] = new Map(); // id -> metadata
    this[EVENT_HANDLERS] = new Map(); // eventType -> Set of handlers
    this[CONNECTED_ROUTERS] = { api: null, view: null };
    this[STORED_ADAPTERS] = new Map(); // id -> { view?, api? }
    this[BUFFERED_ROUTES] = []; // [{ id, adapter, type }]
    this[CONTEXTS] = { view: null, api: null };
  }

  // ---------------------------------------------------------------------------
  // 2. Properties / Accessors
  // ---------------------------------------------------------------------------

  /**
   * Get the registry instance
   * @returns {ExtensionRegistry} The registry instance
   */
  get registry() {
    return this[REGISTRY];
  }

  /**
   * Set the fetch instance
   * @param {Object} fetch - Fetch instance
   */
  set fetch(fetchInstance) {
    this[FETCH] = fetchInstance;
  }

  /**
   * Get the fetch instance
   * @returns {Object} Fetch instance
   */
  get fetch() {
    return this[FETCH];
  }

  /**
   * Set the view container
   * @param {Object} container - View container
   */
  set viewContainer(container) {
    this[CONTEXTS].view = container;
  }

  /**
   * Get the view container
   * @returns {Object} View container
   */
  get viewContainer() {
    return this[CONTEXTS].view;
  }

  /**
   * Set the API container
   * @param {Object} container - API container
   */
  set apiContainer(container) {
    this[CONTEXTS].api = container;
  }

  /**
   * Get the API container
   * @returns {Object} API container
   */
  get apiContainer() {
    return this[CONTEXTS].api;
  }

  /**
   * Build extension asset URL
   * @param {string} id - Extension ID
   * @param {string} filename - Asset filename
   * @returns {string} Extension asset URL
   */
  getExtensionAssetUrl(id, filename) {
    return `/api/extensions/${id}/static/${filename}`;
  }

  // ---------------------------------------------------------------------------
  // 3. Subclass Hooks (template methods — override in server/client)
  // ---------------------------------------------------------------------------

  /**
   * Resolve the container for extension lifecycle hooks.
   * Subclasses override to return the appropriate container:
   * - Client: viewContainer (React app context)
   * - Server: apiContainer (DI container)
   *
   * @returns {Object|null} Container for lifecycle hooks
   * @protected
   */
  _hookContext() {
    return this.viewContainer;
  }

  /**
   * Resolve the extension entry point based on manifest.
   * Override in subclasses.
   *
   * @param {Object} _manifest - Extension manifest
   * @returns {string|null} Entry point filename
   * @protected
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  _resolveEntryPoint(_manifest) {
    return null;
  }

  /**
   * Load extension module.
   * @param {string} _id - Extension ID
   * @param {string} _entryPoint - Resolved entry point filename
   * @param {Object} _manifest - Extension manifest
   * @param {string} _containerName - Container name
   * @returns {Promise<Object|null>} Extension instance or null if skipped
   * @protected
   */
  async _loadExtensionModule(_id, _entryPoint, _manifest, _containerName) {
    return null;
  }

  /**
   * Post-load hook called after an extension is successfully loaded.
   * Subclasses override to perform environment-specific work.
   * Client uses this to eagerly activate module-type namespaces.
   * @param {string} _id - Extension ID
   * @param {Object} _ext - Loaded extension module
   * @param {Object} _manifest - Extension manifest
   * @protected
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async _postLoad(_id, _ext, _manifest) {}

  /**
   * Inject routes for an extension.
   * @param {string} _id - Extension ID
   * @param {*} _hookResult - Return value of the extension's views() hook
   * @param {string} _type - Type of routes (view or api)
   * @protected
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  _injectRoutes(_id, _hookResult, _type) {
    // Override in subclasses
  }

  // ---------------------------------------------------------------------------
  // 4. Initialization
  // ---------------------------------------------------------------------------

  /**
   * Fetch and load all active extensions from API
   */
  async sync() {
    try {
      const { data: response } = await this.fetch('/api/extensions');
      const extensions =
        response && Array.isArray(response.extensions)
          ? response.extensions
          : [];
      const results = await Promise.allSettled(
        extensions.map(item => {
          const id = typeof item === 'object' ? item.id : item;
          const manifest = typeof item === 'object' ? item : null;
          return this.loadExtension(id, manifest);
        }),
      );

      // Report failures
      const failures = results
        .map((result, index) => ({ result, item: extensions[index] }))
        .filter(({ result }) => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn(
          `[ExtensionManager] ${failures.length} extension(s) failed to load:`,
          failures.map(({ item }) =>
            typeof item === 'object' ? item.id : item,
          ),
        );
      }

      // Report success
      const success = results
        .map((result, index) => ({ result, item: extensions[index] }))
        .filter(({ result }) => result.status === 'fulfilled');

      await this.emit('extensions:initialized', {
        total: extensions.length,
        loaded: success.length,
        failed: failures.length,
      });
    } catch (error) {
      console.error('[ExtensionManager] Failed to fetch extensions:', error);
      await this.emit('extensions:init-failed', { error });
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Extension Lifecycle (load / unload / reload / update)
  // ---------------------------------------------------------------------------

  /**
   * Load extension dependencies
   * @param {string} extensionId - Extension requesting dependencies
   * @param {Object<string, string>} dependencies - Map of dependency IDs to version ranges
   * @param {Set} [_loadingChain] - Internal: circular dependency tracking
   */
  async loadDependencies(extensionId, dependencies, _loadingChain) {
    const chain = _loadingChain || new Set();

    // Circular dependency detection
    if (chain.has(extensionId)) {
      const cycle = [...chain, extensionId].join(' → ');
      const error = new Error(`Circular dependency detected: ${cycle}`);
      error.name = 'ExtensionManagerError';
      throw error;
    }
    chain.add(extensionId);

    const missing = Object.keys(dependencies).filter(
      depId => !this[ACTIVE_EXTENSIONS].has(depId),
    );

    if (missing.length > 0) {
      console.log(
        `[ExtensionManager] Loading dependencies for "${extensionId}":`,
        missing,
      );

      await Promise.all(
        missing.map(depId => this.loadExtension(depId, undefined, chain)),
      );
    }
  }

  /**
   * Load a single extension by ID
   * @param {string} id - Extension ID
   * @param {Object} manifest - Optional extension manifest
   * @returns {Promise<Object|null>} Extension instance or null if skipped
   */
  async loadExtension(id, manifest = null, _loadingChain) {
    if (!id || typeof id !== 'string') {
      const error = new Error('Extension ID must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('extension:validation-failed', { id, error });
      console.error(error);
      return;
    }

    // Check if already loaded
    if (this[ACTIVE_EXTENSIONS].has(id)) {
      if (__DEV__) {
        console.warn(`[ExtensionManager] Extension "${id}" is already loaded`);
      }
      return this[ACTIVE_EXTENSIONS].get(id);
    }

    // Initialize metadata
    const metadata = {
      id,
      state: ExtensionState.LOADING,
      version: (manifest && manifest.version) || '0.0.0',
      error: null,
      loadedAt: null,
      require: (manifest && manifest.rsk && manifest.rsk.require) || {},
      manifest,
    };
    this[EXTENSION_METADATA].set(id, metadata);

    try {
      await this.emit('extension:loading', { id });

      // Load extension dependencies first (ensures dependency graph is satisfied)
      // Dependencies are loaded recursively before the extension itself
      if (
        manifest &&
        manifest.rsk &&
        manifest.rsk.require &&
        Object.keys(manifest.rsk.require).length > 0
      ) {
        await this.loadDependencies(id, manifest.rsk.require, _loadingChain);
      }

      // Fetch extension bundle details from API — skip if the manifest
      // already provides containerName (e.g., from sync's getActiveExtensions
      // or server-side refresh with fromDisk = true).
      let containerName =
        manifest && manifest.rsk && manifest.rsk.containerName
          ? manifest.rsk.containerName
          : null;

      if (manifest && manifest.fromDisk) {
        // Clean up the internal flag
        delete manifest.fromDisk;
      }

      if (!containerName) {
        const response = await this.fetch(`/api/extensions/${id}`);
        if (!response || !response.success) {
          const error = new Error(
            (response && response.message) ||
              'Failed to fetch extension bundle',
          );
          error.name = 'ExtensionManagerError';
          throw error;
        }

        const { containerName: cn, manifest: serverManifest } = response.data;
        containerName = cn;
        if (serverManifest) manifest = serverManifest;
      }

      // Resolve entry point (main vs browser)
      // eslint-disable-next-line no-underscore-dangle
      const entryPoint = this._resolveEntryPoint(manifest);

      if (!entryPoint) {
        if (__DEV__) {
          console.log(
            `[ExtensionManager] Skipping execution for ${id} (no entry point for environment)`,
          );
        }

        // Update metadata to show it's loaded safely but has no active instance
        metadata.state = ExtensionState.LOADED;
        metadata.loadedAt = Date.now();
        metadata.manifest = { ...manifest };
        return null;
      }

      // Load the extension module (subclass handles require/MF + unwrapping)
      // eslint-disable-next-line no-underscore-dangle
      const ext = await this._loadExtensionModule(
        id,
        entryPoint,
        manifest,
        containerName,
      );

      // Null = extension was skipped (e.g., API-only on client)
      if (!ext) {
        metadata.state = ExtensionState.LOADED;
        metadata.loadedAt = Date.now();
        metadata.manifest = { ...manifest };
        return null;
      }

      // Accept any object that has at least one recognized extension property
      const hasRecognized = LIFECYCLE_HOOKS.some(
        key => key in ext && ext[key] != null,
      );

      if (!hasRecognized) {
        const error = new Error(
          `Extension must have at least one recognized property (${LIFECYCLE_HOOKS.join(', ')})`,
        );
        error.name = 'ExtensionManagerError';
        throw error;
      }

      // Register with registry
      if (__DEV__) {
        console.log(`[ExtensionManager] Defining extension in registry: ${id}`);
      }

      // eslint-disable-next-line no-underscore-dangle
      await this.registry.defineExtension(ext, this._hookContext(), manifest);

      // Extensions with routes() are module-type (eagerly activated);
      // extensions without routes are plugin-type (lazily activated).
      const hasRoutes = typeof ext.routes === 'function';

      // Post-load hook (client uses this for eager namespace activation)
      // eslint-disable-next-line no-underscore-dangle
      await this._postLoad(id, ext, manifest);

      // Inject view routes (module-type only; plugins have no routes)
      if (hasRoutes) {
        // eslint-disable-next-line no-underscore-dangle
        this._injectRoutes(id, ext.routes(), 'views');
      }

      // Update metadata
      metadata.state = ExtensionState.LOADED;
      metadata.hasRoutes = hasRoutes;
      metadata.loadedAt = Date.now();
      metadata.manifest = { ...manifest };

      if (__DEV__) {
        console.log(`[ExtensionManager] Successfully loaded extension: ${id}`);
      }
      await this.emit('extension:loaded', { id, ext, manifest });

      return ext;
    } catch (error) {
      console.error(
        `[ExtensionManager] Failed to load extension "${id}":`,
        error.message,
      );

      // Update metadata
      metadata.state = ExtensionState.FAILED;
      metadata.error = error;

      await this.emit('extension:failed', { id, error });
    }
  }

  /**
   * Unload an extension by ID
   * @param {string} id - Extension ID
   */
  async unloadExtension(id) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Extension ID must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('extension:validation-failed', { id, error });
      console.error(error);
      return;
    }

    if (!this[ACTIVE_EXTENSIONS].has(id)) {
      console.warn(`[ExtensionManager] Extension "${id}" is not loaded`);
      return;
    }

    const metadata = this[EXTENSION_METADATA].get(id);
    if (metadata) {
      metadata.state = ExtensionState.UNLOADING;
    }

    await this.emit('extension:unloading', { id });

    try {
      // Remove route adapters (buffered + injected)
      // eslint-disable-next-line no-underscore-dangle
      await this._removeRouteAdapters(id);

      // Unregister from registry (clears slots, hooks)
      this.registry.unregister(id);

      // Remove from active extensions
      this[ACTIVE_EXTENSIONS].delete(id);

      // Update metadata
      if (metadata) {
        metadata.state = ExtensionState.UNLOADED;
      }

      console.log(`[ExtensionManager] Successfully unloaded extension: ${id}`);
      await this.emit('extension:unloaded', { id });
    } catch (error) {
      console.error(
        `[ExtensionManager] Failed to unload extension "${id}":`,
        error,
      );

      if (metadata) {
        metadata.state = ExtensionState.FAILED;
        metadata.error = error;
      }

      await this.emit('extension:unload-failed', { id, error });
      console.error(error);
    }
  }

  /**
   * Reload an extension (unload then load)
   * @param {string} id - Extension ID
   */
  async reloadExtension(id) {
    const metadata = this[EXTENSION_METADATA].get(id);
    const manifest = metadata && metadata.manifest;

    await this.unloadExtension(id);
    await this.loadExtension(id, manifest);
  }

  /**
   * Update an extension with a new manifest/version
   * Properly handles uninstall lifecycle before loading new version
   * @param {string} id - Extension ID
   * @param {Object} newManifest - New extension manifest (optional, will fetch if not provided)
   */
  async updateExtension(id, newManifest = null) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Extension ID must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('extension:validation-failed', { id, error });
      console.error(error);
      return;
    }

    const oldMetadata = this[EXTENSION_METADATA].get(id);
    const oldVersion = (oldMetadata && oldMetadata.version) || 'unknown';

    await this.emit('extension:updating', {
      id,
      oldVersion,
      newVersion: (newManifest && newManifest.version) || 'unknown',
    });

    try {
      // Unload existing extension (this calls uninstall hook)
      if (this[ACTIVE_EXTENSIONS].has(id)) {
        await this.unloadExtension(id);
      }

      // Load new version (this calls install hook)
      await this.loadExtension(id, newManifest);

      const newVersion =
        (this[EXTENSION_METADATA].get(id) &&
          this[EXTENSION_METADATA].get(id).version) ||
        'unknown';

      if (__DEV__) {
        console.log(
          `[ExtensionManager] Updated extension: ${id} (${oldVersion} → ${newVersion})`,
        );
      }

      await this.emit('extension:updated', { id, oldVersion, newVersion });
    } catch (error) {
      console.error(
        `[ExtensionManager] Failed to update extension "${id}":`,
        error,
      );
      await this.emit('extension:update-failed', { id, error });
      console.error(error);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Install / Uninstall
  // ---------------------------------------------------------------------------

  /**
   * Install an extension (one-time setup).
   * Orchestrates validation, events, and error handling. Delegates the
   * actual work to `_performInstall` which subclasses can override.
   *
   * @param {string} id - Extension ID
   * @param {Object} [manifest] - Extension manifest (server uses for disk loading)
   * @returns {Promise<boolean>} True if installed successfully
   */
  async installExtension(id, manifest) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Extension ID must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('extension:validation-failed', { id, error });
      console.error(error);
      return false;
    }

    await this.emit('extension:installing', { id });

    try {
      // eslint-disable-next-line no-underscore-dangle
      const result = await this._performInstall(id, manifest);
      if (result) {
        if (__DEV__) {
          console.log(`[ExtensionManager] Installed extension: ${id}`);
        }
        await this.emit('extension:installed', { id });
      }
      return result;
    } catch (error) {
      console.error(
        `[ExtensionManager] Failed to install extension "${id}":`,
        error,
      );
      await this.emit('extension:install-failed', { id, error });
      throw error;
    }
  }

  /**
   * Perform the actual install work.
   * Base: delegates to registry. Server: overrides to load from disk.
   *
   * @param {string} id - Extension ID
   * @param {Object} [_manifest] - Extension manifest
   * @returns {Promise<boolean>}
   * @protected
   */
  // eslint-disable-next-line no-unused-vars
  async _performInstall(id, _manifest) {
    return this.registry.runInstallHook(id);
  }

  /**
   * Uninstall an extension (one-time teardown).
   * Orchestrates validation, events, and error handling. Delegates the
   * actual work to `_performUninstall` which subclasses can override.
   *
   * @param {string} id - Extension ID
   * @param {Object} [manifest] - Extension manifest (server uses for disk loading)
   * @returns {Promise<boolean>} True if uninstalled successfully
   */
  async uninstallExtension(id, manifest) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Extension ID must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('extension:validation-failed', { id, error });
      console.error(error);
      return false;
    }

    await this.emit('extension:uninstalling', { id });

    try {
      // eslint-disable-next-line no-underscore-dangle
      const result = await this._performUninstall(id, manifest);
      if (result) {
        if (__DEV__) {
          console.log(`[ExtensionManager] Uninstalled extension: ${id}`);
        }
        await this.emit('extension:uninstalled', { id });
      }
      return result;
    } catch (error) {
      console.error(
        `[ExtensionManager] Failed to uninstall extension "${id}":`,
        error,
      );
      await this.emit('extension:uninstall-failed', { id, error });
      throw error;
    }
  }

  /**
   * Perform the actual uninstall work.
   * Base: delegates to registry. Server: overrides to load from disk + revert.
   *
   * @param {string} id - Extension ID
   * @param {Object} [_manifest] - Extension manifest
   * @returns {Promise<boolean>}
   * @protected
   */
  // eslint-disable-next-line no-unused-vars
  async _performUninstall(id, _manifest) {
    return this.registry.runUninstallHook(id);
  }

  // ---------------------------------------------------------------------------
  // 8. Activate / Deactivate
  // ---------------------------------------------------------------------------

  /**
   * Activate an extension's runtime (API lifecycle: boot, routes, etc.).
   * Orchestrates validation, events, and error handling. Delegates the
   * actual work to `_performActivate` which subclasses can override.
   *
   * @param {string} id - Extension ID
   * @param {Object} [manifest] - Extension manifest (server uses for disk loading)
   * @returns {Promise<boolean>} True if activated successfully
   */
  async activateExtension(id, manifest) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Extension ID must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('extension:validation-failed', { id, error });
      console.error(error);
      return false;
    }

    await this.emit('extension:activating', { id });

    try {
      // eslint-disable-next-line no-underscore-dangle
      const result = await this._performActivate(id, manifest);
      if (result) {
        // Transition metadata state to ACTIVE
        const meta = this[EXTENSION_METADATA].get(id);
        if (meta) meta.state = ExtensionState.ACTIVE;

        if (__DEV__) {
          console.log(`[ExtensionManager] Activated extension: ${id}`);
        }
        await this.emit('extension:activated', { id });
      }
      return result;
    } catch (error) {
      console.error(
        `[ExtensionManager] Failed to activate extension "${id}":`,
        error,
      );
      await this.emit('extension:activate-failed', { id, error });
      throw error;
    }
  }

  /**
   * Perform the actual activate work.
   * Base: no-op. Server: overrides to load API module and run full lifecycle.
   *
   * @param {string} _id - Extension ID
   * @param {Object} [_manifest] - Extension manifest
   * @returns {Promise<boolean>}
   * @protected
   */
  // eslint-disable-next-line no-unused-vars
  async _performActivate(_id, _manifest) {
    return true;
  }

  /**
   * Deactivate an extension's runtime (teardown API: destroy, remove routes).
   * Orchestrates validation, events, and error handling. Delegates the
   * actual work to `_performDeactivate` which subclasses can override.
   *
   * @param {string} id - Extension ID
   * @param {Object} [manifest] - Extension manifest
   * @returns {Promise<boolean>} True if deactivated successfully
   */
  async deactivateExtension(id, manifest) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Extension ID must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('extension:validation-failed', { id, error });
      console.error(error);
      return false;
    }

    await this.emit('extension:deactivating', { id });

    try {
      // eslint-disable-next-line no-underscore-dangle
      const result = await this._performDeactivate(id, manifest);
      if (result) {
        if (__DEV__) {
          console.log(`[ExtensionManager] Deactivated extension: ${id}`);
        }
        await this.emit('extension:deactivated', { id });
      }
      return result;
    } catch (error) {
      console.error(
        `[ExtensionManager] Failed to deactivate extension "${id}":`,
        error,
      );
      await this.emit('extension:deactivate-failed', { id, error });
      throw error;
    }
  }

  /**
   * Perform the actual deactivate work.
   * Base: no-op. Server: overrides to shutdown API, remove routes, clean up.
   *
   * @param {string} _id - Extension ID
   * @param {Object} [_manifest] - Extension manifest
   * @returns {Promise<boolean>}
   * @protected
   */
  // eslint-disable-next-line no-unused-vars
  async _performDeactivate(_id, _manifest) {
    return true;
  }

  // ---------------------------------------------------------------------------
  // 9. Namespace Management
  // ---------------------------------------------------------------------------

  /**
   * Activate a namespace only if it is not already active.
   * Convenience wrapper around isViewNamespaceActive + activateViewNamespace.
   * @param {string} ns - Namespace to ensure is active
   */
  async ensureViewNamespaceActive(ns) {
    if (this.isViewNamespaceActive(ns)) {
      if (__DEV__) {
        console.log(`[ExtensionManager] Namespace already active: ${ns}`);
      }
      return;
    }
    if (__DEV__) {
      console.log(`[ExtensionManager] Activating namespace: ${ns}`);
    }
    await this.activateViewNamespace(ns);
  }

  /**
   * Check if a namespace is loaded (at least one extension from it is registered)
   * @param {string} ns - Namespace to check
   * @returns {boolean}
   */
  isViewNamespaceActive(ns) {
    const extensions = this.registry.getDefinitions(ns);
    if (!extensions) return false;

    for (const def of extensions) {
      if (this.registry.has(def.id)) return true;
    }
    return false;
  }

  /**
   * Load all extensions for a given namespace (runtime activation)
   * @param {string} ns - Namespace to load
   */
  async activateViewNamespace(ns) {
    if (typeof ns !== 'string' || ns.trim().length === 0) {
      const error = new Error('Namespace must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('namespace:validation-failed', { ns, error });
      console.error(error);
      return;
    }

    await this.emit('namespace:loading', { ns });

    try {
      const extensions = this.registry.getDefinitions(ns);
      if (!extensions) {
        return;
      }

      // Filter to unactivated extensions only
      const pending = Array.from(extensions).filter(def => {
        if (this[ACTIVE_EXTENSIONS].has(def.id)) {
          if (__DEV__) {
            console.log(
              `[ExtensionManager] Extension "${def.id}" is already active. Skipping.`,
            );
          }
          return false;
        }
        return true;
      });

      if (pending.length === 0) return;

      if (__DEV__) {
        console.log(
          `[ExtensionManager] Activating ${pending.length} extension(s) for namespace "${ns}"`,
        );
      }

      // eslint-disable-next-line no-underscore-dangle
      const context = this._hookContext();

      // ── Phase 1: Translations (all extensions) ──
      for (const def of pending) {
        if (typeof def.translations === 'function') {
          try {
            const translations = getTranslations(def.translations());
            if (Object.keys(translations).length > 0) {
              addNamespace(`extension:${def.id}`, translations);
            }
          } catch (error) {
            console.error(
              `[ExtensionManager] Failed to register translations for ${def.id}:`,
              error,
            );
          }
        }
      }

      // ── Phase 2: Providers (all extensions) ──
      for (const def of pending) {
        if (typeof def.providers === 'function') {
          try {
            // eslint-disable-next-line no-await-in-loop
            await def.providers({ ...context, registry: this.registry });
          } catch (error) {
            console.error(
              `[ExtensionManager] Failed to run providers for ${def.id}:`,
              error,
            );
          }
        }
      }

      // ── Phase 3: Boot (all extensions) ──
      for (const def of pending) {
        if (typeof def.boot === 'function') {
          try {
            // eslint-disable-next-line no-await-in-loop
            await def.boot({ ...context, registry: this.registry });
          } catch (error) {
            console.error(
              `[ExtensionManager] Failed to boot extension ${def.id}:`,
              error,
            );
            // eslint-disable-next-line no-await-in-loop
            await this.emit('extension:boot-error', {
              id: def.id,
              error,
              phase: 'boot',
            });
          }
        }
      }

      // ── Phase 4: Register + mark ACTIVE ──
      for (const def of pending) {
        this.registry.register(def.id, def);
        this[ACTIVE_EXTENSIONS].set(def.id, def);

        const meta = this[EXTENSION_METADATA].get(def.id);
        if (meta) meta.state = ExtensionState.ACTIVE;
      }

      if (__DEV__) {
        console.log(`[ExtensionManager] Loaded namespace: ${ns}`);
      }
      await this.emit('namespace:loaded', { ns });
    } catch (error) {
      console.error(
        `[ExtensionManager] Failed to load namespace "${ns}":`,
        error,
      );
      await this.emit('namespace:load-failed', { ns, error });
      console.error(error);
    }
  }

  /**
   * Unload all extensions for a given namespace (runtime deactivation)
   * @param {string} ns - Namespace to unload
   */
  async deactivateViewNamespace(ns) {
    if (typeof ns !== 'string' || ns.trim().length === 0) {
      const error = new Error('Namespace must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('namespace:validation-failed', { ns, error });
      console.error(error);
      return;
    }

    await this.emit('namespace:unloading', { ns });

    try {
      const extensions = this.registry.getDefinitions(ns);
      if (!extensions) return;

      const active = Array.from(extensions).filter(def =>
        this[ACTIVE_EXTENSIONS].has(def.id),
      );

      if (active.length === 0) return;

      // eslint-disable-next-line no-underscore-dangle
      const context = this._hookContext();

      // ── Phase 1: Shutdown (all extensions) ──
      for (const def of active) {
        if (typeof def.shutdown === 'function') {
          try {
            // eslint-disable-next-line no-await-in-loop
            await def.shutdown({ ...context, registry: this.registry });
          } catch (error) {
            console.error(
              `[ExtensionManager] Failed to shutdown extension ${def.id}:`,
              error,
            );
            // eslint-disable-next-line no-await-in-loop
            await this.emit('extension:shutdown-error', {
              id: def.id,
              error,
              phase: 'shutdown',
            });
          }
        }
      }

      // ── Phase 2: Remove translations (all extensions) ──
      for (const def of active) {
        removeNamespace(`extension:${def.id}`);
      }

      // ── Phase 3: Unregister + mark INACTIVE ──
      for (const def of active) {
        this.registry.unregister(def.id);
        this[ACTIVE_EXTENSIONS].delete(def.id);
      }

      if (__DEV__) {
        console.log(`[ExtensionManager] Unloaded namespace: ${ns}`);
      }
      await this.emit('namespace:unloaded', { ns });
    } catch (error) {
      console.error(
        `[ExtensionManager] Failed to unload namespace "${ns}":`,
        error,
      );
      await this.emit('namespace:unload-failed', { ns, error });
      console.error(error);
    }
  }

  // ---------------------------------------------------------------------------
  // 10. Route Management
  // ---------------------------------------------------------------------------

  /**
   * Connect a router instance and flush pending/stored route adapters.
   *
   * Shared logic for both view and API routers:
   * 1. Stores the router reference
   * 2. Drains pending injections matching `routerKey` from buffer → store
   * 3. Re-injects all stored adapters for `routerKey` into the router
   *
   * @param {string} routerKey - 'views' or 'api'
   * @param {Object} router - Router instance with add(adapter) method
   * @param {Function} [injectFn] - Optional custom injection: (router, adapter, id) => void
   */
  _connectRouter(routerKey, router, injectFn) {
    this[CONNECTED_ROUTERS][routerKey] = router;

    // 1. Drain pending injections for this router key (buffer → store)
    const remaining = [];
    for (const entry of this[BUFFERED_ROUTES]) {
      const entryKey = entry.type;
      if (entryKey === routerKey) {
        if (!this[STORED_ADAPTERS].has(entry.id)) {
          this[STORED_ADAPTERS].set(entry.id, {});
        }
        this[STORED_ADAPTERS].get(entry.id)[routerKey] = entry.adapter;
      } else {
        remaining.push(entry);
      }
    }
    this[BUFFERED_ROUTES].length = 0;
    this[BUFFERED_ROUTES].push(...remaining);

    // 2. Inject all stored adapters for this router key
    if (router) {
      const inject = injectFn || ((r, adapter) => r.add(adapter));
      for (const [id, adapters] of this[STORED_ADAPTERS].entries()) {
        if (adapters[routerKey]) {
          inject(router, adapters[routerKey], id);
        }
      }
    }
  }

  /**
   * Remove all route adapters (buffered, stored, and injected) for an extension.
   *
   * 1. Purges any pending buffered routes for this extension
   * 2. Removes injected adapters from connected routers
   * 3. Cleans up stored adapter references
   *
   * @param {string} id - Extension ID
   * @param {Function} [removeFn] - Optional custom removal: (router, adapter, id) => void
   *        Defaults to router.remove(adapter). Client overrides for string-based removal.
   * @returns {Promise<void>}
   * @protected
   */
  async _removeRouteAdapters(id, removeFn) {
    // 1. Purge buffered routes for this extension (prevents stale injection)
    const remaining = this[BUFFERED_ROUTES].filter(entry => entry.id !== id);
    this[BUFFERED_ROUTES].length = 0;
    this[BUFFERED_ROUTES].push(...remaining);

    // 2. Remove from connected routers
    const adapters = this[STORED_ADAPTERS].get(id);
    if (adapters) {
      const remove = removeFn || ((router, adapter) => router.remove(adapter));
      for (const routerKey of ['views', 'api']) {
        try {
          const router = this[CONNECTED_ROUTERS][routerKey];
          if (router && adapters[routerKey]) {
            await remove(router, adapters[routerKey], id);
          }
        } catch (error) {
          console.error(
            `[ExtensionManager] Failed to remove route adapters for ${id}:`,
            error,
          );
          await this.emit('extension:remove-route-adapters-error', {
            id,
            error,
            phase: 'remove-route-adapters',
          });
        }
      }
    }

    // 3. Clean up stored reference
    this[STORED_ADAPTERS].delete(id);

    if (__DEV__) {
      console.log(`[ExtensionManager] Removed route adapters for: ${id}`);
    }
  }

  /**
   * Connect the view router instance.
   * @param {Object} viewRouter - View router with add/remove methods
   */
  connectViewRouter(viewRouter) {
    // eslint-disable-next-line no-underscore-dangle
    this._connectRouter('views', viewRouter);
  }

  // ---------------------------------------------------------------------------
  // 11. Refresh
  // ---------------------------------------------------------------------------

  /**
   * Refresh extensions (unload, reset state, re-fetch).
   * Unlike destroy(), this preserves context and event handlers,
   * allowing the manager to immediately re-initialize.
   *
   * @param {...string} extensionIds - Specific IDs to refresh (empty = all)
   */
  async refresh(...extensionIds) {
    // Targeted refresh — delegate to subclass hook
    if (extensionIds.length > 0) {
      // eslint-disable-next-line no-underscore-dangle
      return this._refreshExtensions(extensionIds);
    }

    // Full refresh: unload all, reset state, re-fetch
    if (__DEV__) {
      console.log('[ExtensionManager] Refreshing all...');
    }

    await this.emit('extensions:refreshing', { extensionIds: null });

    const allIds = Array.from(this[ACTIVE_EXTENSIONS].keys());
    await Promise.all(allIds.map(id => this.unloadExtension(id)));

    this[ACTIVE_EXTENSIONS].clear();
    this[EXTENSION_METADATA].clear();

    await this.sync();

    await this.emit('extensions:refreshed', { extensionIds: null });

    if (__DEV__) {
      console.log('[ExtensionManager] Refreshed');
    }
  }

  /**
   * Targeted refresh hook — subclasses override to refresh specific extensions.
   * Base class does not support targeted refresh (no disk access).
   *
   * @param {string[]} _extensionIds - Extension IDs to refresh
   * @protected
   */
  // eslint-disable-next-line no-unused-vars
  async _refreshExtensions(_extensionIds) {
    throw new Error(
      '_refreshExtensions must be overridden for targeted refresh',
    );
  }

  // ---------------------------------------------------------------------------
  // 12. Queries
  // ---------------------------------------------------------------------------

  /**
   * Get extension by ID
   * @param {string} id - Extension ID
   * @returns {Object|null} Extension instance or null
   */
  getExtension(id) {
    return this[ACTIVE_EXTENSIONS].get(id) || null;
  }

  /**
   * Get all loaded extensions
   * @returns {Array<Object>} Array of extension instances
   */
  getAllExtensions() {
    return Array.from(this[ACTIVE_EXTENSIONS].values());
  }

  /**
   * Get extension metadata
   * @param {string} id - Extension ID
   * @returns {ExtensionMetadata|null}
   */
  getExtensionMetadata(id) {
    return this[EXTENSION_METADATA].get(id) || null;
  }

  /**
   * Get all extension metadata
   * @returns {Array<ExtensionMetadata>}
   */
  getAllExtensionMetadata() {
    return Array.from(this[EXTENSION_METADATA].values());
  }

  /**
   * Check if extension is loaded
   * @param {string} id - Extension ID
   * @returns {boolean}
   */
  isExtensionLoaded(id) {
    return this[ACTIVE_EXTENSIONS].has(id);
  }

  /**
   * Get extension state
   * @param {string} id - Extension ID
   * @returns {string|null} Extension state or null
   */
  getExtensionState(id) {
    const metadata = this[EXTENSION_METADATA].get(id);
    return (metadata && metadata.state) || null;
  }

  // ---------------------------------------------------------------------------
  // 13. Event System
  // ---------------------------------------------------------------------------

  /**
   * Event emitter - emit an event
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @returns {Promise<void>}
   */
  async emit(eventType, data) {
    const handlers = this[EVENT_HANDLERS].get(eventType);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const handlerPromises = Array.from(handlers).map(handler =>
      Promise.resolve()
        .then(() => handler(data))
        .catch(error => {
          console.error(
            `[ExtensionManager] Event handler error for "${eventType}":`,
            error,
          );
          // Optionally re-throw or handle based on your error strategy
        }),
    );

    await Promise.all(handlerPromises);
  }

  /**
   * Event emitter - subscribe to an event
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    if (!this[EVENT_HANDLERS].has(eventType)) {
      this[EVENT_HANDLERS].set(eventType, new Set());
    }

    const handlers = this[EVENT_HANDLERS].get(eventType);
    handlers.add(handler);

    // Return unsubscribe function
    return () => this.off(eventType, handler);
  }

  /**
   * Event emitter - unsubscribe from an event
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler (optional - if omitted, removes all handlers)
   */
  off(eventType, handler) {
    const handlers = this[EVENT_HANDLERS].get(eventType);
    if (!handlers) {
      return;
    }

    if (handler) {
      handlers.delete(handler);
      // Clean up empty event type
      if (handlers.size === 0) {
        this[EVENT_HANDLERS].delete(eventType);
      }
    } else {
      // Remove all handlers for this event type
      this[EVENT_HANDLERS].delete(eventType);
    }
  }

  // ---------------------------------------------------------------------------
  // 14. Teardown
  // ---------------------------------------------------------------------------

  /**
   * Clean up resources.
   * Deactivates API, unloads all extensions, clears state.
   */
  async destroy() {
    if (__DEV__) {
      console.log('[ExtensionManager] Destroying...');
    }

    await this.emit('manager:destroying');

    // Unload all extensions
    const extensionIds = Array.from(this[ACTIVE_EXTENSIONS].keys());
    await Promise.all(extensionIds.map(id => this.unloadExtension(id)));

    // Clear all base state
    this[ACTIVE_EXTENSIONS].clear();
    this[EXTENSION_METADATA].clear();
    this[FETCH] = null;
    this[CONTEXTS] = { view: null, api: null };

    await this.emit('manager:destroyed');

    // Clear all event handlers last
    this[EVENT_HANDLERS].clear();

    if (__DEV__) {
      console.log('[ExtensionManager] Destroyed');
    }
  }
}
