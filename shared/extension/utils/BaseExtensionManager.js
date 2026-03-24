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
import { addNamespace } from '@shared/i18n/utils';

import { registry } from './Registry';

// Symbols for internal state
export const INITIALIZED = Symbol('__rsk.initializedExtensions__');
export const ACTIVE_EXTENSIONS = Symbol('__rsk.activeExtensions__');
export const EXTENSION_CONTEXT = Symbol('__rsk.extensionContext__');
export const EXTENSION_METADATA = Symbol('__rsk.extensionMetadata__');
export const EVENT_HANDLERS = Symbol('__rsk.extensionEventHandlers__');
export const LOADED_VERSIONS = Symbol('__rsk.loadedExtensionVersions__');
export const EXTENSION_INIT = Symbol('__rsk.extensionInit__');

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
  constructor() {
    this[INITIALIZED] = false;
    this[EXTENSION_CONTEXT] = null;
    this[ACTIVE_EXTENSIONS] = new Map(); // id -> extension instance
    this[EXTENSION_METADATA] = new Map(); // id -> metadata
    this[EVENT_HANDLERS] = new Map(); // eventType -> Set of handlers
    this[LOADED_VERSIONS] = new Map(); // extensionId -> version
    this[EXTENSION_INIT] = null; // initialization promise
  }

  /**
   * Get the registry instance
   * @returns {Registry} The registry instance
   */
  get registry() {
    return registry;
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

  /**
   * Ensure the extension manager is ready (abstract method)
   * Subclasses should override to implement environment-specific initialization.
   * @returns {Promise<void>}
   */
  async _ensureReady() {
    // Override in subclasses
  }

  /**
   * Whether module-kind extensions should eagerly activate during loadExtension.
   * Client returns true (persistent store available), server returns false
   * (no persistent store at boot; SSR activates per-request via onRouteInit).
   * @returns {boolean}
   */
  // eslint-disable-next-line class-methods-use-this
  _shouldEagerActivate() {
    return true;
  }

  /**
   * Initialize the extension manager
   *
   * @param {Object} context - Application context
   * @param {Function} context.fetch - Fetch function for API calls (required)
   * @param {Object} [context.store] - Redux store instance
   * @param {Object} [context.i18n] - i18n instance
   * @param {Object} [context.history] - History instance (client only)
   * @param {string} [context.locale] - Current locale
   * @param {string} [context.pathname] - Current pathname (client only)
   * @param {Object} [context.query] - Query parameters (client only)
   * @param {string} [context.cwd] - Current working directory (server only)
   * @param {AbortSignal} [context.signal] - Abort signal for request cancellation (server only)
   *
   * @note Server context: Initialized once at startup with server-level context
   * @note Client context: Initialized before app startup, updated on navigation
   */
  async init(context) {
    if (!context || typeof context.fetch !== 'function') {
      const error = new Error(
        'ExtensionManager requires a valid context with fetch method',
      );
      error.name = 'ExtensionManagerError';
      throw error;
    }

    // Update context for the current request/navigation
    this[EXTENSION_CONTEXT] = context;

    // Singleton pattern: Skip re-initialization if already initialized
    // This prevents redundant extension loading on subsequent calls (e.g., per-request on server)
    // We check the explicit INITIALIZED flag instead of active extension count
    // to handle cases where no extensions are installed (count = 0)
    if (this[INITIALIZED]) {
      return;
    }

    this[INITIALIZED] = true;

    // Subclasses can implement this
    this.onReady();

    await this.syncExtensions();
  }

  /**
   * Fetch and load all active extensions from API
   */
  async syncExtensions() {
    try {
      const { data: response } =
        await this[EXTENSION_CONTEXT].fetch('/api/extensions');
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

  /**
   * Resolve the extension entry point based on manifest
   * @param {Object} _manifest - Extension manifest
   * @returns {string} Entry point filename
   */
  resolveEntryPoint(_manifest) {
    // Override in subclasses
    return null;
  }

  /**
   * Load extension module
   * @param {string} _id - Extension ID
   * @param {string} _entryPoint - Resolved entry point filename
   * @param {Object} _manifest - Extension manifest
   * @param {Object} _options - Additional options (containerName)
   * @returns {Promise<Object|null>} Extension instance or null if skipped
   */
  async _bootstrapExtension(_id, _entryPoint, _manifest, _options) {
    // Override in subclasses
    return null;
  }

  /**
   * Inject view routes from an extension module that provides a views() hook.
   *
   * Calls views(), auto-derives the namespace from the views() tuple
   * [moduleName, context] for module-kind extensions (so activateNamespace()
   * can find and initialise them, e.g. inject Redux reducers), then delegates
   * to the subclass _injectRoutes implementation.
   *
   * @param {string} id - Extension ID
   * @param {Object} ext - Extension module exports
   * @param {Object} manifest - Extension manifest (mutated in place)
   * @param {...any} injectArgs - Extra args forwarded to _injectRoutes
   * @returns {boolean} True if routes were injected
   * @protected
   */
  _injectViewRoutes(id, ext, manifest, ...injectArgs) {
    if (!ext || typeof ext.views !== 'function') return false;

    const viewsResult = ext.views();

    // Auto-subscribe module namespace from [moduleName, context] tuple
    if (
      Array.isArray(viewsResult) &&
      viewsResult.length === 2 &&
      typeof viewsResult[0] === 'string'
    ) {
      const moduleName = viewsResult[0];
      const rsk = manifest.rsk || {};
      const subs = rsk.subscribe || [];
      if (!subs.includes(moduleName)) {
        // eslint-disable-next-line no-param-reassign
        manifest.rsk = { ...rsk, subscribe: [...subs, moduleName] };
      }
    }

    // eslint-disable-next-line no-underscore-dangle
    this._injectRoutes(id, viewsResult, ...injectArgs);

    return true;
  }

  /**
   * Load extension dependencies
   * @param {string} extensionId - Extension requesting dependencies
   * @param {Array<Object<string, string>>} dependencies - Array of dependency IDs
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
   * Validate extension structure
   * @param {Object} ext - Extension object
   */
  validateExtensionStructure(ext) {
    if (!ext || typeof ext !== 'object') {
      const error = new Error('Extension must be an object');
      error.name = 'ExtensionManagerError';
      throw error;
    }

    // Extensions must have at least an init function or a name property
    const hasInit = typeof ext.init === 'function';
    const hasName = 'name' in ext;

    if (!hasInit && !hasName) {
      const error = new Error(
        'Extension must have either an "init" function or a "name" property',
      );
      error.name = 'ExtensionManagerError';
      throw error;
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
    this[EXTENSION_METADATA].set(id, {
      id,
      state: ExtensionState.LOADING,
      version: (manifest && manifest.version) || '0.0.0',
      error: null,
      loadedAt: null,
      require: (manifest && manifest.rsk && manifest.rsk.require) || [],
      manifest,
    });

    await this.emit('extension:loading', { id });

    try {
      // Load extension dependencies first (ensures dependency graph is satisfied)
      // Dependencies are loaded recursively before the extension itself
      if (
        manifest &&
        manifest.rsk &&
        manifest.rsk.require &&
        manifest.rsk.require.length > 0
      ) {
        await this.loadDependencies(id, manifest.rsk.require, _loadingChain);
      }

      // Fetch extension bundle details from API — skip if the caller
      // explicitly marked the manifest as read from disk (server-side
      // refresh sets fromDisk = true after reading the built manifest).
      let containerName = null;

      if (manifest && manifest.fromDisk) {
        // Server-side refresh: manifest was read directly from disk
        containerName = manifest.rsk && manifest.rsk.containerName;
        // Clean up the internal flag
        delete manifest.fromDisk;
      } else {
        const response = await this[EXTENSION_CONTEXT].fetch(
          `/api/extensions/${id}`,
        );
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
      const entryPoint = this.resolveEntryPoint(manifest);

      if (!entryPoint) {
        if (__DEV__) {
          console.log(
            `[ExtensionManager] Skipping execution for ${id} (no entry point for environment)`,
          );
        }
        // Update metadata to show it's loaded safely but has no active instance
        const metadata = this[EXTENSION_METADATA].get(id);
        metadata.state = ExtensionState.LOADED;
        metadata.loadedAt = Date.now();
        metadata.manifest = { ...manifest };
        return null;
      }

      // Load the extension module (subclass handles require/MF + unwrapping)
      // eslint-disable-next-line no-underscore-dangle
      const ext = await this._bootstrapExtension(id, entryPoint, manifest, {
        containerName,
      });

      // Null = extension was skipped (e.g., API-only on client)
      if (!ext) {
        const metadata = this[EXTENSION_METADATA].get(id);
        metadata.state = ExtensionState.LOADED;
        metadata.loadedAt = Date.now();
        metadata.manifest = { ...manifest };
        return null;
      }

      // Validate extension structure
      this.validateExtensionStructure(ext);

      // Register with registry
      if (__DEV__) {
        console.log(`[ExtensionManager] Defining extension in registry: ${id}`);
      }
      // eslint-disable-next-line no-underscore-dangle
      await registry.defineExtension(ext, this[EXTENSION_CONTEXT], manifest);

      // Determine extension kind: 'module' (has views() hook) or 'plugin'
      const extensionType =
        (manifest.rsk && manifest.rsk.kind) ||
        (typeof ext.views === 'function' ? 'module' : 'plugin');

      // Module-kind extensions auto-subscribe to a namespace derived from
      // their views() hook. Activate eagerly so init() runs immediately
      // (injecting Redux reducers and registering sidebar menus) rather than
      // waiting for route-based activateNamespace which creates a
      // chicken-and-egg problem (menu invisible → can't navigate → can't activate).
      // Plugin-kind extensions activate lazily on route navigation via onRouteInit.
      // eslint-disable-next-line no-underscore-dangle
      if (extensionType === 'module' && this._shouldEagerActivate()) {
        const subs =
          manifest.rsk && Array.isArray(manifest.rsk.subscribe)
            ? manifest.rsk.subscribe
            : [];
        for (const ns of subs) {
          // eslint-disable-next-line no-await-in-loop
          await this.ensureNamespaceActive(ns);
        }
      }

      // Update metadata
      const metadata = this[EXTENSION_METADATA].get(id);
      metadata.state = ExtensionState.LOADED;
      metadata.kind = extensionType;
      metadata.loadedAt = Date.now();
      metadata.manifest = { ...manifest };

      // Call extension lifecycle hook
      if (typeof ext.onLoad === 'function') {
        // eslint-disable-next-line no-underscore-dangle
        await ext.onLoad(this[EXTENSION_CONTEXT]);
      }

      if (__DEV__) {
        console.log(`[ExtensionManager] Successfully loaded extension: ${id}`);
      }
      await this.emit('extension:loaded', { id, ext, manifest });

      return ext;
    } catch (error) {
      console.error(
        `[ExtensionManager] Failed to load extension "${id}":`,
        error,
      );

      // Update metadata
      const metadata = this[EXTENSION_METADATA].get(id);
      if (metadata) {
        metadata.state = ExtensionState.FAILED;
        metadata.error = error;
      }

      await this.emit('extension:failed', { id, error });
      console.error(error);
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
      const ext = this[ACTIVE_EXTENSIONS].get(id);

      // Call extension lifecycle hook
      if (ext && typeof ext.onUnload === 'function') {
        // eslint-disable-next-line no-underscore-dangle
        await ext.onUnload(this[EXTENSION_CONTEXT]);
      }

      // Unregister from registry
      // eslint-disable-next-line no-underscore-dangle
      await registry.unregister(id, this[EXTENSION_CONTEXT]);

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

  /**
   * Install an extension (one-time setup, calls install() lifecycle hook).
   *
   * Client: delegates to the registry which finds the extension
   * definition by ID and calls its `install()` hook.
   *
   * Server: `ServerExtensionManager` overrides this method to load the API module
   * directly from disk (the extension may not yet be registered in the Registry).
   *
   * @param {string} id - Extension ID
   * @returns {Promise<boolean>} True if installed successfully
   */
  async installExtension(id) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Extension ID must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('extension:validation-failed', { id, error });
      console.error(error);
      return;
    }

    await this.emit('extension:installing', { id });

    try {
      const result = await registry.runInstallHook(id);
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
      console.error(error);
    }
  }

  /**
   * Uninstall an extension (one-time teardown, calls uninstall() lifecycle hook).
   *
   * Client: delegates to the registry which finds the extension
   * definition by ID and calls its `uninstall()` hook.
   *
   * Server: `ServerExtensionManager` overrides this method to load the API module
   * directly from disk (the extension may already be unloaded from the Registry).
   *
   * @param {string} id - Extension ID
   * @returns {Promise<boolean>} True if uninstalled successfully
   */
  async uninstallExtension(id) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Extension ID must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('extension:validation-failed', { id, error });
      console.error(error);
      return;
    }

    await this.emit('extension:uninstalling', { id });

    try {
      const result = await registry.runUninstallHook(id);
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
      console.error(error);
    }
  }

  /**
   * Activate a namespace only if it is not already active.
   * Convenience wrapper around isNamespaceActive + activateNamespace.
   * @param {string} ns - Namespace to ensure is active
   */
  async ensureNamespaceActive(ns) {
    if (this.isNamespaceActive(ns)) {
      if (__DEV__) {
        console.log(`[ExtensionManager] Namespace already active: ${ns}`);
      }
      return;
    }
    if (__DEV__) {
      console.log(`[ExtensionManager] Activating namespace: ${ns}`);
    }
    await this.activateNamespace(ns);
  }

  /**
   * Check if a namespace is loaded (at least one extension from it is registered)
   * @param {string} ns - Namespace to check
   * @returns {boolean}
   */
  isNamespaceActive(ns) {
    const extensions = registry.getDefinitions(ns);
    if (!extensions) return false;

    for (const def of extensions) {
      if (registry.has(def.id)) return true;
    }
    return false;
  }

  /**
   * Get the kind of an extension ('module' or 'plugin')
   * @param {string} id - Extension ID
   * @returns {string|null} 'module', 'plugin', or null if not found
   */
  getExtensionKind(id) {
    const meta = this[EXTENSION_METADATA].get(id);
    return meta ? meta.kind : null;
  }

  /**
   * Check if an extension is module-kind (has views, eagerly activated)
   * @param {string} id - Extension ID
   * @returns {boolean}
   */
  isModuleExtension(id) {
    return this.getExtensionKind(id) === 'module';
  }

  /**
   * Check if an extension is plugin-kind (no views, lazily activated on route)
   * @param {string} id - Extension ID
   * @returns {boolean}
   */
  isPluginExtension(id) {
    return this.getExtensionKind(id) === 'plugin';
  }

  /**
   * Load all extensions for a given namespace (runtime activation)
   * @param {string} ns - Namespace to load
   */
  async activateNamespace(ns) {
    if (typeof ns !== 'string' || ns.trim().length === 0) {
      const error = new Error('Namespace must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('namespace:validation-failed', { ns, error });
      console.error(error);
      return;
    }

    await this.emit('namespace:loading', { ns });

    try {
      const extensions = registry.getDefinitions(ns);
      if (!extensions) {
        return;
      }
      if (__DEV__) {
        console.log(
          `[ExtensionManager] Found ${extensions.size} extensions for namespace ${ns}`,
        );
      }

      for (const def of extensions) {
        if (this[ACTIVE_EXTENSIONS].has(def.id)) {
          if (__DEV__) {
            console.log(
              `[ExtensionManager] Extension "${def.id}" is already active. Skipping component registration.`,
            );
          }
          continue;
        }

        if (__DEV__) {
          console.log(
            `[ExtensionManager] Loading extension from namespace: ${def.id}`,
          );
        }

        // Wrap init/destroy for the standard register method
        const extInstance = {
          ...def,
          init: async reg => {
            if (__DEV__) {
              console.log(
                `[ExtensionManager] Initializing extension: ${def.id}`,
              );
            }

            // Auto-register translations before init if extension exports translations()
            if (typeof def.translations === 'function') {
              try {
                const translations = getTranslations(def.translations());
                if (Object.keys(translations).length > 0) {
                  addNamespace(
                    `extension:${def.id}`,
                    translations,
                    this[EXTENSION_CONTEXT].i18n,
                  );
                }
              } catch (error) {
                console.error(
                  `[ExtensionManager] Failed to register translations for ${def.id}:`,
                  error,
                );
              }
            }

            if (typeof def.init === 'function') {
              try {
                // eslint-disable-next-line no-underscore-dangle
                await def.init(reg, this[EXTENSION_CONTEXT]);
              } catch (error) {
                console.error(
                  `[ExtensionManager] Failed to initialize extension ${def.id}:`,
                  error,
                );
                await this.emit('extension:init-error', {
                  id: def.id,
                  error,
                  phase: 'init',
                });
              }
            } else if (__DEV__) {
              console.warn(
                `[ExtensionManager] Extension ${def.id} has no 'init' method`,
              );
            }
          },
          destroy: async reg => {
            if (__DEV__) {
              console.log(`[ExtensionManager] Destroying extension: ${def.id}`);
            }
            if (typeof def.destroy === 'function') {
              try {
                // eslint-disable-next-line no-underscore-dangle
                await def.destroy(reg, this[EXTENSION_CONTEXT]);
              } catch (error) {
                console.error(
                  `[ExtensionManager] Failed to destroy extension ${def.id}:`,
                  error,
                );
                await this.emit('extension:destroy-error', {
                  id: def.id,
                  error,
                  phase: 'destroy',
                });
              }
            } else if (__DEV__) {
              console.warn(
                `[ExtensionManager] Extension ${def.id} has no 'destroy' method`,
              );
            }
          },
        };

        await registry.register(def.id, extInstance);
        this[ACTIVE_EXTENSIONS].set(def.id, extInstance);

        // Transition metadata state to ACTIVE
        const meta = this[EXTENSION_METADATA].get(def.id);
        if (meta) {
          meta.state = ExtensionState.ACTIVE;
        }
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
  async deactivateNamespace(ns) {
    if (typeof ns !== 'string' || ns.trim().length === 0) {
      const error = new Error('Namespace must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('namespace:validation-failed', { ns, error });
      console.error(error);
      return;
    }

    await this.emit('namespace:unloading', { ns });

    try {
      const extensions = registry.getDefinitions(ns);
      if (!extensions) return;

      for (const def of extensions) {
        await registry.unregister(def.id, this[EXTENSION_CONTEXT]);
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

  /**
   * Subscribe to events (abstract method)
   */
  onReady() {
    // Override in subclasses
  }

  /**
   * Handle external event (abstract method)
   * Subclasses should implement for environment-specific event handling.
   * @param {Object} _event - Event object
   */
  async onWebSocketEvent(_event) {
    // Override in subclasses
  }

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
  /**
   * Refresh extensions (unload, reset state, re-fetch)
   * Unlike destroy(), this preserves context and event handlers,
   * allowing the manager to immediately re-initialize.
   *
   * @param {Array<string>} [extensionIds] - Specific extension IDs to refresh.
   *   If provided, only those extensions are reloaded (unload → load).
   *   If omitted or empty, all extensions are refreshed.
   */
  async refresh(...extensionIds) {
    // Guard: if context was destroyed (e.g. by HMR dispose), skip refresh.
    // The manager will be re-initialized via init() when the new bundle loads.
    if (!this[EXTENSION_CONTEXT]) {
      if (__DEV__) {
        console.log(
          '[ExtensionManager] Skipping refresh (no context, manager was destroyed)',
        );
      }
      return;
    }

    // Resolve incoming names to actual extension IDs.
    // The build tool sends manifest names but the
    // extension manager tracks extensions by their API IDs (UUIDs).  We match
    // incoming names against manifest.name stored in extension metadata.
    let resolvedIds = [];

    if (extensionIds.length > 0) {
      const nameSet = new Set(extensionIds);

      for (const [id, metadata] of this[EXTENSION_METADATA].entries()) {
        const manifestName = metadata.manifest && metadata.manifest.name;
        if (nameSet.has(id) || (manifestName && nameSet.has(manifestName))) {
          resolvedIds.push(id);
        }
      }

      resolvedIds = [...new Set(resolvedIds)];
    }

    const specific = resolvedIds.length > 0;

    if (__DEV__) {
      console.log(
        `[ExtensionManager] Refreshing${specific ? `: ${resolvedIds.join(', ')}` : ' all'}...`,
      );
    }

    await this.emit('extensions:refreshing', { extensionIds: resolvedIds });

    if (specific) {
      // Targeted refresh: properly tear down and reload each extension
      for (const id of resolvedIds) {
        // Unload if active (registered in a namespace)
        if (this[ACTIVE_EXTENSIONS].has(id)) {
          await this.unloadExtension(id);
        }

        // Clean up metadata and version tracking
        this[EXTENSION_METADATA].delete(id);
        this[LOADED_VERSIONS].delete(id);
      }

      // Re-load the extensions (syncExtensions would re-load everything;
      // here we load only the targeted ones)
      await Promise.all(resolvedIds.map(id => this.loadExtension(id)));
    } else {
      // Full refresh: unload all, reset state, re-fetch
      const allIds = Array.from(this[ACTIVE_EXTENSIONS].keys());
      await Promise.all(allIds.map(id => this.unloadExtension(id)));

      this[ACTIVE_EXTENSIONS].clear();
      this[EXTENSION_METADATA].clear();
      this[LOADED_VERSIONS].clear();
      this[INITIALIZED] = false;
      this[EXTENSION_INIT] = null;

      await this.syncExtensions();
    }

    await this.emit('extensions:refreshed', {
      extensionIds: specific ? resolvedIds : null,
    });

    if (__DEV__) {
      console.log('[ExtensionManager] Refreshed');
    }
  }

  /**
   * Clean up resources
   */
  async destroy() {
    if (__DEV__) {
      console.log('[ExtensionManager] Destroying...');
    }

    await this.emit('manager:destroying');

    // Unload all extensions
    const extensionIds = Array.from(this[ACTIVE_EXTENSIONS].keys());
    await Promise.all(extensionIds.map(id => this.unloadExtension(id)));

    // Clear all internal state
    this[ACTIVE_EXTENSIONS].clear();
    this[EXTENSION_METADATA].clear();

    this[LOADED_VERSIONS].clear();
    this[EXTENSION_CONTEXT] = null;
    this[INITIALIZED] = false;
    this[EXTENSION_INIT] = null;

    await this.emit('manager:destroyed');

    // Clear all event handlers last
    this[EVENT_HANDLERS].clear();

    if (__DEV__) {
      console.log('[ExtensionManager] Destroyed');
    }
  }
}
