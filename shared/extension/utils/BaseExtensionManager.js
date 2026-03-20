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
export const EXTENSION_MANAGER_INIT = Symbol('__rsk.extensionManagerInit__');

/**
 * Plugin states
 */
export const ExtensionState = Object.freeze({
  PENDING: 'pending',
  LOADING: 'loading',
  LOADED: 'loaded',
  FAILED: 'failed',
  UNLOADING: 'unloading',
  UNLOADED: 'unloaded',
});

/**
 * Plugin metadata structure
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
    this[ACTIVE_EXTENSIONS] = new Map(); // id -> plugin instance
    this[EXTENSION_METADATA] = new Map(); // id -> metadata
    this[EVENT_HANDLERS] = new Map(); // eventType -> Set of handlers
    this[LOADED_VERSIONS] = new Map(); // pluginId -> version
    this[EXTENSION_MANAGER_INIT] = null; // initialization promise
  }

  /**
   * Get the registry instance
   * @returns {Registry} The registry instance
   */
  get registry() {
    return registry;
  }

  /**
   * Build plugin asset URL
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
    // This prevents redundant plugin loading on subsequent calls (e.g., per-request on server)
    // We check the explicit INITIALIZED flag instead of active plugin count
    // to handle cases where no extensions are installed (count = 0)
    if (this[INITIALIZED]) {
      return;
    }

    this[INITIALIZED] = true;

    // Subclasses can implement this
    this.subscribeToEvents();

    await this.fetchAll();
  }

  /**
   * Fetch and load all active plugins from API
   */
  async fetchAll() {
    try {
      const { data: response } =
        await this[EXTENSION_CONTEXT].fetch('/api/extensions');
      const plugins =
        response && Array.isArray(response.extensions) ? response.extensions : [];
      const results = await Promise.allSettled(
        plugins.map(plugin => {
          const id = typeof plugin === 'object' ? plugin.id : plugin;
          const manifest = typeof plugin === 'object' ? plugin : null;
          return this.loadExtension(id, manifest);
        }),
      );

      // Report failures
      const failures = results
        .map((result, index) => ({ result, plugin: plugins[index] }))
        .filter(({ result }) => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn(
          `[ExtensionManager] ${failures.length} extension(s) failed to load:`,
          failures.map(({ plugin }) =>
            typeof plugin === 'object' ? plugin.id : plugin,
          ),
        );
      }

      // Report success
      const success = results
        .map((result, index) => ({ result, plugin: plugins[index] }))
        .filter(({ result }) => result.status === 'fulfilled');

      await this.emit('extensions:initialized', {
        total: plugins.length,
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
   * @param {Object} _manifest - Plugin manifest
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
   * @param {Object} _manifest - Plugin manifest
   * @param {Object} _options - Additional options (containerName)
   * @returns {Promise<Object|null>} Extension instance or null if skipped
   */
  async loadExtensionModule(_id, _entryPoint, _manifest, _options) {
    // Override in subclasses
    return null;
  }

  /**
   * Load extension dependencies
   * @param {string} pluginId - Plugin requesting dependencies
   * @param {Array<Object<string, string>>} dependencies - Array of dependency IDs
   */
  async loadDependencies(pluginId, dependencies) {
    const missing = Object.keys(dependencies).filter(
      depId => !this[ACTIVE_EXTENSIONS].has(depId),
    );

    if (missing.length > 0) {
      console.log(
        `[ExtensionManager] Loading dependencies for "${pluginId}":`,
        missing,
      );

      await Promise.all(missing.map(depId => this.loadExtension(depId)));
    }
  }

  /**
   * Execute extension code safely
   * @param {string} id - Extension ID
   * @param {string} entryPoint - Resolved entry point filename
   * @param {Object} manifest - Plugin manifest
   * @param {Object} options - Additional options (containerName)
   * @returns {Promise<Object|null>} Extension instance or null if skipped
   */
  async executeExtension(id, entryPoint, manifest, options) {
    try {
      const pluginModule = await this.loadExtensionModule(
        id,
        entryPoint,
        manifest,
        options,
      );

      // Null is valid - extension was skipped (e.g., API-only on client)
      if (!pluginModule) {
        if (__DEV__) {
          console.log(
            `[ExtensionManager] Extension ${id} returned null module (skipped)`,
          );
        }
        const err = new Error(`Extension "${id}" returned null module (skipped)`);
        err.name = 'PluginSkippedError';
        err.status = 400;
        throw err;
      }

      // Handle various export formats
      let plugin = pluginModule.default || pluginModule;

      // If it's still a module namespace object with no default, try finding the plugin object
      if (
        plugin &&
        typeof plugin === 'object' &&
        !('register' in plugin) &&
        !('name' in plugin)
      ) {
        if (id && plugin[id]) {
          plugin = plugin[id];
        }
      }

      if (__DEV__) {
        console.log(
          `[ExtensionManager] Loaded extension module for ${id}:`,
          typeof plugin,
          'Keys:',
          Object.keys(plugin || {}),
        );
      }

      if (!plugin) {
        const error = new Error(
          `Extension "${id}" did not export a valid extension object`,
        );
        error.name = 'ExtensionManagerError';
        error.pluginId = id;
        throw error;
      }

      return plugin;
    } catch (error) {
      // Wrap other errors with context
      const err = new Error(
        `Extension execution failed for "${id}": ${error.message}`,
      );
      err.name = 'ExtensionManagerError';
      err.pluginId = id;
      err.originalError = error;
      console.error(`[ExtensionManager] Extension "${id}" failed to load:`, err);

      // Only throw in dev mode
      if (__DEV__) {
        throw err;
      }
    }
  }

  /**
   * Validate extension structure
   * @param {Object} plugin - Plugin object
   */
  validateExtensionStructure(plugin) {
    if (!plugin || typeof plugin !== 'object') {
      const error = new Error('Extension must be an object');
      error.name = 'ExtensionManagerError';
      throw error;
    }

    // Extensions must have at least an init function or a name property
    const hasInit = typeof plugin.init === 'function';
    const hasName = 'name' in plugin;

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
  async loadExtension(id, manifest = null) {
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
      // Dependencies are loaded recursively before the plugin itself
      if (
        manifest &&
        manifest.rsk &&
        manifest.rsk.require &&
        manifest.rsk.require.length > 0
      ) {
        await this.loadDependencies(id, manifest.rsk.require);
      }

      // Fetch plugin bundle details from API — skip if the caller
      // explicitly marked the manifest as read from disk (server-side
      // refresh sets fromDisk = true after reading the built manifest).
      let containerName = null;

      if (manifest && manifest.fromDisk) {
        // Server-side refresh: manifest was read directly from disk
        containerName = manifest.rsk && manifest.rsk.containerName;
        // Clean up the internal flag
        delete manifest.fromDisk;
      } else {
        const response = await this[EXTENSION_CONTEXT].fetch(`/api/extensions/${id}`);
        if (!response || !response.success) {
          const error = new Error(
            (response && response.message) || 'Failed to fetch plugin bundle',
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

      // Load the plugin via MF container or require
      let plugin = await this.executeExtension(id, entryPoint, manifest, {
        containerName,
      });

      // Handle null return (extension was skipped by loadExtensionModule)
      if (!plugin) {
        const metadata = this[EXTENSION_METADATA].get(id);
        metadata.state = ExtensionState.LOADED;
        metadata.loadedAt = Date.now();
        metadata.manifest = { ...manifest };
        return null;
      }

      // Handle ES module default export
      plugin = plugin.default || plugin;

      // Validate extension structure
      this.validateExtensionStructure(plugin);

      // Register with registry
      if (__DEV__) {
        console.log(`[ExtensionManager] Defining plugin in registry: ${id}`);
      }
      await registry.define(plugin, this[EXTENSION_CONTEXT], manifest);

      // Plugin activation (init/destroy) is deferred to loadNamespace.
      // loadExtension only fetches, validates, and defines.

      // Update metadata
      const metadata = this[EXTENSION_METADATA].get(id);
      metadata.state = ExtensionState.LOADED;
      metadata.loadedAt = Date.now();
      metadata.manifest = { ...manifest };

      // Call plugin lifecycle hook
      if (typeof plugin.onLoad === 'function') {
        await plugin.onLoad(this[EXTENSION_CONTEXT]);
      }

      if (__DEV__) {
        console.log(`[ExtensionManager] Successfully loaded extension: ${id}`);
      }
      await this.emit('extension:loaded', { id, plugin, manifest });

      return plugin;
    } catch (error) {
      console.error(`[ExtensionManager] Failed to load extension "${id}":`, error);

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
      const plugin = this[ACTIVE_EXTENSIONS].get(id);

      // Call plugin View lifecycle hook
      if (plugin && typeof plugin.onUnload === 'function') {
        await plugin.onUnload(this[EXTENSION_CONTEXT]);
      }

      // Unregister from registry
      await registry.unregister(id, this[EXTENSION_CONTEXT]);

      // Remove from active plugins
      this[ACTIVE_EXTENSIONS].delete(id);

      // Update metadata
      if (metadata) {
        metadata.state = ExtensionState.UNLOADED;
      }

      console.log(`[ExtensionManager] Successfully unloaded extension: ${id}`);
      await this.emit('extension:unloaded', { id });
    } catch (error) {
      console.error(`[ExtensionManager] Failed to unload extension "${id}":`, error);

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
      // Unload existing plugin (this calls uninstall hook)
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
      console.error(`[ExtensionManager] Failed to update extension "${id}":`, error);
      await this.emit('extension:update-failed', { id, error });
      console.error(error);
    }
  }

  /**
   * Install an extension (one-time setup, calls install() lifecycle hook).
   *
   * Client: delegates to `registry.installExtension()` which finds the plugin
   * definition by ID and calls its `install()` hook.
   *
   * Server: `ServerExtensionManager` overrides this method to load the API module
   * directly from disk (the plugin may not yet be registered in the Registry).
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
      const result = await registry.installExtension(id);
      if (result) {
        if (__DEV__) {
          console.log(`[ExtensionManager] Installed extension: ${id}`);
        }
        await this.emit('extension:installed', { id });
      }
      return result;
    } catch (error) {
      console.error(`[ExtensionManager] Failed to install extension "${id}":`, error);
      await this.emit('extension:install-failed', { id, error });
      console.error(error);
    }
  }

  /**
   * Uninstall an extension (one-time teardown, calls uninstall() lifecycle hook).
   *
   * Client: delegates to `registry.uninstallExtension()` which finds the plugin
   * definition by ID and calls its `uninstall()` hook.
   *
   * Server: `ServerExtensionManager` overrides this method to load the API module
   * directly from disk (the plugin may already be unloaded from the Registry).
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
      const result = await registry.uninstallExtension(id);
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
   * Check if a namespace is loaded (at least one extension from it is registered)
   * @param {string} ns - Namespace to check
   * @returns {boolean}
   */
  isNamespaceLoaded(ns) {
    const plugins = registry.getDefinitions(ns);
    if (!plugins) return false;

    for (const plugin of plugins) {
      if (registry.has(plugin.id)) return true;
    }
    return false;
  }

  /**
   * Load all plugins for a given namespace (runtime activation)
   * @param {string} ns - Namespace to load
   */
  async loadNamespace(ns) {
    if (typeof ns !== 'string' || ns.trim().length === 0) {
      const error = new Error('Namespace must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('namespace:validation-failed', { ns, error });
      console.error(error);
      return;
    }

    await this.emit('namespace:loading', { ns });

    try {
      const plugins = registry.getDefinitions(ns);
      if (!plugins) {
        return;
      }
      if (__DEV__) {
        console.log(
          `[ExtensionManager] Found ${plugins.size} extensions for namespace ${ns}`,
        );
      }

      for (const plugin of plugins) {
        if (this[ACTIVE_EXTENSIONS].has(plugin.id)) {
          if (__DEV__) {
            console.log(
              `[ExtensionManager] Extension "${plugin.id}" is already active. Skipping component registration.`,
            );
          }
          continue;
        }

        if (__DEV__) {
          console.log(
            `[ExtensionManager] Loading extension from namespace: ${plugin.id}`,
          );
        }

        // Wrap init/destroy for the standard register method
        const pluginInstance = {
          ...plugin,
          init: async reg => {
            if (__DEV__) {
              console.log(`[ExtensionManager] Initializing extension: ${plugin.id}`);
            }

            // Auto-register translations before init if extension exports translations()
            if (typeof plugin.translations === 'function') {
              try {
                const translations = getTranslations(plugin.translations());
                if (Object.keys(translations).length > 0) {
                  addNamespace(
                    `extension:${plugin.id}`,
                    translations,
                    this[EXTENSION_CONTEXT].i18n,
                  );
                }
              } catch (error) {
                console.error(
                  `[ExtensionManager] Failed to register translations for ${plugin.id}:`,
                  error,
                );
              }
            }

            if (typeof plugin.init === 'function') {
              try {
                await plugin.init(reg, this[EXTENSION_CONTEXT]);
              } catch (error) {
                console.error(
                  `[ExtensionManager] Failed to initialize extension ${plugin.id}:`,
                  error,
                );
                await this.emit('extension:init-error', {
                  id: plugin.id,
                  error,
                  phase: 'init',
                });
              }
            } else if (__DEV__) {
              console.warn(
                `[ExtensionManager] Extension ${plugin.id} has no 'init' method`,
              );
            }
          },
          destroy: async reg => {
            if (__DEV__) {
              console.log(`[ExtensionManager] Destroying extension: ${plugin.id}`);
            }
            if (typeof plugin.destroy === 'function') {
              try {
                await plugin.destroy(reg, this[EXTENSION_CONTEXT]);
              } catch (error) {
                console.error(
                  `[ExtensionManager] Failed to destroy extension ${plugin.id}:`,
                  error,
                );
                await this.emit('extension:destroy-error', {
                  id: plugin.id,
                  error,
                  phase: 'destroy',
                });
              }
            } else if (__DEV__) {
              console.warn(
                `[ExtensionManager] Extension ${plugin.id} has no 'destroy' method`,
              );
            }
          },
        };

        await registry.register(plugin.id, pluginInstance);
        this[ACTIVE_EXTENSIONS].set(plugin.id, pluginInstance);
      }

      if (__DEV__) {
        console.log(`[ExtensionManager] Loaded namespace: ${ns}`);
      }
      await this.emit('namespace:loaded', { ns });
    } catch (error) {
      console.error(`[ExtensionManager] Failed to load namespace "${ns}":`, error);
      await this.emit('namespace:load-failed', { ns, error });
      console.error(error);
    }
  }

  /**
   * Unload all extensions for a given namespace (runtime deactivation)
   * @param {string} ns - Namespace to unload
   */
  async unloadNamespace(ns) {
    if (typeof ns !== 'string' || ns.trim().length === 0) {
      const error = new Error('Namespace must be a non-empty string');
      error.name = 'ExtensionManagerError';
      await this.emit('namespace:validation-failed', { ns, error });
      console.error(error);
      return;
    }

    await this.emit('namespace:unloading', { ns });

    try {
      const plugins = registry.getDefinitions(ns);
      if (!plugins) return;

      for (const plugin of plugins) {
        await registry.unregister(plugin.id, this[EXTENSION_CONTEXT]);
        this[ACTIVE_EXTENSIONS].delete(plugin.id);
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
  subscribeToEvents() {
    // Override in subclasses
  }

  /**
   * Handle external event (abstract method)
   * Subclasses should implement for environment-specific event handling.
   * @param {Object} _event - Event object
   */
  async handleEvent(_event) {
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
   * @param {Array<string>} [pluginIds] - Specific extension IDs to refresh.
   *   If provided, only those extensions are reloaded (unload → load).
   *   If omitted or empty, all extensions are refreshed.
   */
  async refresh(...pluginIds) {
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

    // Resolve incoming names to actual plugin IDs.
    // The build tool sends manifest names (e.g. 'rsk_plugin_test') but the
    // extension manager tracks plugins by their API IDs (UUIDs).  We match
    // incoming names against manifest.name stored in extension metadata.
    let resolvedIds = [];

    if (pluginIds.length > 0) {
      const nameSet = new Set(pluginIds);

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

    await this.emit('extensions:refreshing', { pluginIds: resolvedIds });

    if (specific) {
      // Targeted refresh: properly tear down and reload each plugin
      for (const id of resolvedIds) {
        // Unload if active (registered in a namespace)
        if (this[ACTIVE_EXTENSIONS].has(id)) {
          await this.unloadExtension(id);
        }

        // Clean up metadata and version tracking
        this[EXTENSION_METADATA].delete(id);
        this[LOADED_VERSIONS].delete(id);
      }

      // Re-load the plugins (fetchAll would re-load everything;
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
      this[EXTENSION_MANAGER_INIT] = null;

      await this.fetchAll();
    }

    await this.emit('extensions:refreshed', {
      pluginIds: specific ? resolvedIds : null,
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
    const pluginIds = Array.from(this[ACTIVE_EXTENSIONS].keys());
    await Promise.all(pluginIds.map(id => this.unloadExtension(id)));

    // Clear all internal state
    this[ACTIVE_EXTENSIONS].clear();
    this[EXTENSION_METADATA].clear();

    this[LOADED_VERSIONS].clear();
    this[EXTENSION_CONTEXT] = null;
    this[INITIALIZED] = false;
    this[EXTENSION_MANAGER_INIT] = null;

    await this.emit('manager:destroyed');

    // Clear all event handlers last
    this[EVENT_HANDLERS].clear();

    if (__DEV__) {
      console.log('[ExtensionManager] Destroyed');
    }
  }
}
