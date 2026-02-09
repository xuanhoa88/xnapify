/**
 * React Starter Kit (https://github.com/xuanhoa/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Base Plugin Manager
 * Handles dynamic loading, unloading, and synchronization of plugins.
 * Shared logic for both server and client.
 */
import { registry } from '../Registry';

export const INITIALIZED = Symbol('__rsk.initializedPlugins__');
export const ACTIVE_PLUGINS = Symbol('__rsk.activePlugins__');
export const PLUGIN_CONTEXT = Symbol('__rsk.pluginContext__');
export const PLUGIN_METADATA = Symbol('__rsk.pluginMetadata__');
export const EVENT_HANDLERS = Symbol('__rsk.pluginEventHandlers__');
export const LOADED_VERSIONS = Symbol('__rsk.loadedPluginVersions__');
export const PLUGIN_CSS_ENTRY_POINTS = Symbol('__rsk.pluginCssEntryPoints__');
export const PLUGIN_MANAGER_INIT = Symbol('__rsk.pluginManagerInit__');

/**
 * Plugin states
 */
export const PluginState = Object.freeze({
  PENDING: 'pending',
  LOADING: 'loading',
  LOADED: 'loaded',
  FAILED: 'failed',
  UNLOADING: 'unloading',
  UNLOADED: 'unloaded',
});

/**
 * Plugin metadata structure
 * @typedef {Object} PluginMetadata
 * @property {string} id - Plugin identifier
 * @property {string} state - Current plugin state
 * @property {string} version - Plugin version
 * @property {Error|null} error - Last error if any
 * @property {number} loadedAt - Timestamp when loaded
 * @property {Array<string>} dependencies - Plugin dependencies
 * @property {Object} manifest - Full plugin manifest
 */

export class BasePluginManager {
  constructor() {
    this[INITIALIZED] = false;
    this[PLUGIN_CONTEXT] = null;
    this[ACTIVE_PLUGINS] = new Map(); // id -> plugin instance
    this[PLUGIN_METADATA] = new Map(); // id -> metadata
    this[EVENT_HANDLERS] = new Map(); // eventType -> Set of handlers
    this[PLUGIN_CSS_ENTRY_POINTS] = new Map(); // id -> cssFiles array
    this[LOADED_VERSIONS] = new Map(); // pluginId -> version
    this[PLUGIN_MANAGER_INIT] = null; // initialization promise
  }

  /**
   * Ensure the plugin manager is ready (abstract method)
   * Subclasses should override to implement environment-specific initialization.
   * @returns {Promise<void>}
   */
  async _ensureReady() {
    // Override in subclasses
  }

  /**
   * Initialize the plugin manager
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
    // Singleton pattern: Skip re-initialization if already initialized
    // This prevents redundant plugin loading on subsequent calls (e.g., per-request on server)
    // We check the explicit INITIALIZED flag instead of active plugin count
    // to handle cases where no plugins are installed (count = 0)
    if (this[INITIALIZED]) {
      // Update context for the current request/navigation
      this[PLUGIN_CONTEXT] = context;
      return;
    }

    if (!context || typeof context.fetch !== 'function') {
      const error = new Error(
        'PluginManager requires a valid context with fetch method',
      );
      error.name = 'PluginManagerError';
      throw error;
    }

    this[PLUGIN_CONTEXT] = context;

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
        await this[PLUGIN_CONTEXT].fetch('/api/plugins');
      const plugins =
        response && Array.isArray(response.plugins) ? response.plugins : [];
      const results = await Promise.allSettled(
        plugins.map(plugin => {
          const id = typeof plugin === 'object' ? plugin.id : plugin;
          const manifest = typeof plugin === 'object' ? plugin : null;
          return this.loadPlugin(id, manifest);
        }),
      );

      // Report failures
      const failures = results
        .map((result, index) => ({ result, plugin: plugins[index] }))
        .filter(({ result }) => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn(
          `[PluginManager] ${failures.length} plugin(s) failed to load:`,
          failures.map(({ plugin }) =>
            typeof plugin === 'object' ? plugin.id : plugin,
          ),
        );
      }

      // Report success
      const success = results
        .map((result, index) => ({ result, plugin: plugins[index] }))
        .filter(({ result }) => result.status === 'fulfilled');

      await this.emit('plugins:initialized', {
        total: plugins.length,
        loaded: success.length,
        failed: failures.length,
      });

      // Mark as initialized after all plugins are loaded
      if (success.length > 0) {
        this[INITIALIZED] = true;
      }
    } catch (error) {
      console.error('[PluginManager] Failed to fetch plugins:', error);
      await this.emit('plugins:init-failed', { error });
    }
  }

  /**
   * Resolve the plugin entry point based on manifest
   * @param {Object} _manifest - Plugin manifest
   * @returns {string} Entry point filename
   */
  resolveEntryPoint(_manifest) {
    // Override in subclasses
    return null;
  }

  /**
   * Load plugin module
   * @param {string} _id - Plugin ID
   * @param {string} _entryPoint - Resolved entry point filename
   * @param {Object} _manifest - Plugin manifest
   * @param {Object} _options - Additional options (containerName, internalId)
   * @returns {Promise<Object|null>} Plugin instance or null if skipped
   */
  async loadPluginModule(_id, _entryPoint, _manifest, _options) {
    // Override in subclasses
    return null;
  }

  /**
   * Get all plugin CSS URLs for SSR injection
   * @returns {Array<string>} Array of CSS URLs
   */
  getPluginCssUrls() {
    const urls = [];
    for (const [, cssFiles] of this[PLUGIN_CSS_ENTRY_POINTS]) {
      urls.push(...cssFiles);
    }
    return urls;
  }

  /**
   * Clean up plugin CSS resources from DOM (client-side only)
   * @param {string} id - Plugin ID
   */
  cleanupPluginResources(id) {
    // Remove CSS links
    const cssUrls = this[PLUGIN_CSS_ENTRY_POINTS].get(id);
    if (cssUrls && typeof document !== 'undefined') {
      for (const url of cssUrls) {
        const link = document.querySelector(`link[href="${url}"]`);
        if (link) {
          link.remove();
          if (__DEV__) {
            console.log(`[PluginManager] Removed CSS: ${url}`);
          }
        }
      }
    }
    this[PLUGIN_CSS_ENTRY_POINTS].delete(id);

    // Remove JS scripts (by plugin ID data attribute)
    if (typeof document !== 'undefined') {
      const scripts = document.querySelectorAll(
        `script[data-plugin-id="${id}"]`,
      );
      scripts.forEach(script => {
        script.remove();
        if (__DEV__) {
          console.log(`[PluginManager] Removed script for: ${id}`);
        }
      });
    }
  }

  /**
   * Load plugin dependencies
   * @param {string} pluginId - Plugin requesting dependencies
   * @param {Array<string>} dependencies - Array of dependency IDs
   */
  async loadDependencies(pluginId, dependencies) {
    const missing = dependencies.filter(
      depId => !this[ACTIVE_PLUGINS].has(depId),
    );

    if (missing.length > 0) {
      console.log(
        `[PluginManager] Loading dependencies for "${pluginId}":`,
        missing,
      );

      await Promise.all(missing.map(depId => this.loadPlugin(depId)));
    }
  }

  /**
   * Execute plugin code safely
   * @param {string} id - Plugin ID
   * @param {string} entryPoint - Resolved entry point filename
   * @param {Object} manifest - Plugin manifest
   * @param {Object} options - Additional options (containerName, internalId)
   * @returns {Promise<Object|null>} Plugin instance or null if skipped
   */
  async executePlugin(id, entryPoint, manifest, options) {
    try {
      const pluginModule = await this.loadPluginModule(
        id,
        entryPoint,
        manifest,
        options,
      );

      // Null is valid - plugin was skipped (e.g., API-only on client)
      if (!pluginModule) {
        if (__DEV__) {
          console.log(
            `[PluginManager] Plugin ${id} returned null module (skipped)`,
          );
        }
        throw new Error(`Plugin "${id}" returned null module (skipped)`);
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
          `[PluginManager] Loaded plugin module for ${id}:`,
          typeof plugin,
          'Keys:',
          Object.keys(plugin || {}),
        );
      }

      if (!plugin) {
        const error = new Error(
          `Plugin "${id}" did not export a valid plugin object`,
        );
        error.name = 'PluginManagerError';
        error.pluginId = id;
        throw error;
      }

      return plugin;
    } catch (error) {
      // Wrap other errors with context
      const err = new Error(
        `Plugin execution failed for "${id}": ${error.message}`,
      );
      err.name = 'PluginManagerError';
      err.pluginId = id;
      err.originalError = error;
      console.error(`[PluginManager] Plugin "${id}" failed to load:`, err);

      // Only throw in dev mode
      if (__DEV__) {
        throw err;
      }
    }
  }

  /**
   * Validate plugin structure
   * @param {Object} plugin - Plugin object
   */
  validatePluginStructure(plugin) {
    if (!plugin || typeof plugin !== 'object') {
      const error = new Error('Plugin must be an object');
      error.name = 'PluginManagerError';
      throw error;
    }

    // Check for either 'name' property OR 'register' function
    const hasName = 'name' in plugin;
    const hasRegister = typeof plugin.register === 'function';

    if (!hasName && !hasRegister) {
      const error = new Error(
        'Plugin must have either a "name" property or a "register" function',
      );
      error.name = 'PluginManagerError';
      throw error;
    }
  }

  /**
   * Load a single plugin by ID
   * @param {string} id - Plugin ID
   * @param {Object} manifest - Optional plugin manifest
   * @returns {Promise<Object|null>} Plugin instance or null if skipped
   */
  async loadPlugin(id, manifest = null) {
    if (!id || typeof id !== 'string') {
      const error = new Error('Plugin ID must be a non-empty string');
      error.name = 'PluginManagerError';
      await this.emit('plugin:validation-failed', { id, error });
      console.error(error);
      return;
    }

    // Check if already loaded
    if (this[ACTIVE_PLUGINS].has(id)) {
      if (__DEV__) {
        console.warn(`[PluginManager] Plugin "${id}" is already loaded`);
      }
      return this[ACTIVE_PLUGINS].get(id);
    }

    // Initialize metadata
    this[PLUGIN_METADATA].set(id, {
      id,
      state: PluginState.LOADING,
      version: (manifest && manifest.version) || 'unknown',
      error: null,
      loadedAt: null,
      dependencies: (manifest && manifest.dependencies) || [],
      manifest,
    });

    await this.emit('plugin:loading', { id });

    try {
      // Load plugin dependencies first (ensures dependency graph is satisfied)
      // Dependencies are loaded recursively before the plugin itself
      if (
        manifest &&
        manifest.dependencies &&
        manifest.dependencies.length > 0
      ) {
        await this.loadDependencies(id, manifest.dependencies);
      }

      // Fetch plugin bundle from API
      const response = await this[PLUGIN_CONTEXT].fetch(`/api/plugins/${id}`);
      if (!response || !response.success) {
        const error = new Error(
          (response && response.message) || 'Failed to fetch plugin bundle',
        );
        error.name = 'PluginManagerError';
        throw error;
      }

      const {
        containerName,
        manifest: serverManifest,
        internalId,
      } = response.data;
      if (serverManifest) manifest = serverManifest;
      // Add internalId to manifest for server-side loading
      if (internalId && manifest) manifest.internalId = internalId;

      // Resolve entry point (main vs browser)
      const entryPoint = this.resolveEntryPoint(manifest);

      if (!entryPoint) {
        if (__DEV__) {
          console.log(
            `[PluginManager] Skipping execution for ${id} (no entry point for environment)`,
          );
        }
        // Update metadata to show it's loaded safely but has no active instance
        const metadata = this[PLUGIN_METADATA].get(id);
        metadata.state = PluginState.LOADED;
        metadata.loadedAt = Date.now();
        metadata.manifest = { ...manifest };
        return null;
      }

      // Load the plugin via MF container or require
      let plugin = await this.executePlugin(id, entryPoint, manifest, {
        containerName,
        internalId,
      });

      // Handle null return (plugin was skipped by loadPluginModule)
      if (!plugin) {
        const metadata = this[PLUGIN_METADATA].get(id);
        metadata.state = PluginState.LOADED;
        metadata.loadedAt = Date.now();
        metadata.manifest = { ...manifest };
        return null;
      }

      // Handle ES module default export
      plugin = plugin.default || plugin;

      // Validate plugin structure
      this.validatePluginStructure(plugin);

      // Register with registry
      if (__DEV__) {
        console.log(`[PluginManager] Defining plugin in registry: ${id}`);
      }
      await registry.define(plugin, this[PLUGIN_CONTEXT]);

      // Call init() lifecycle hook (runtime activation)
      await registry.register(id, plugin, this[PLUGIN_CONTEXT]);

      // Store plugin instance
      this[ACTIVE_PLUGINS].set(id, plugin);

      // Update metadata
      const metadata = this[PLUGIN_METADATA].get(id);
      metadata.state = PluginState.LOADED;
      metadata.loadedAt = Date.now();
      metadata.manifest = { ...manifest };

      // Call plugin lifecycle hook
      if (typeof plugin.onLoad === 'function') {
        await plugin.onLoad(this[PLUGIN_CONTEXT]);
      }

      if (__DEV__) {
        console.log(`[PluginManager] Successfully loaded plugin: ${id}`);
      }
      await this.emit('plugin:loaded', { id, plugin });

      // Store CSS files from manifest if available (for SSR injection)
      if (serverManifest && Array.isArray(serverManifest.cssFiles)) {
        this[PLUGIN_CSS_ENTRY_POINTS].set(
          id,
          serverManifest.cssFiles.map(
            cssFile => `/api/plugins/${id}/static/${cssFile}`,
          ),
        );
      }

      return plugin;
    } catch (error) {
      console.error(`[PluginManager] Failed to load plugin "${id}":`, error);

      // Update metadata
      const metadata = this[PLUGIN_METADATA].get(id);
      if (metadata) {
        metadata.state = PluginState.FAILED;
        metadata.error = error;
      }

      await this.emit('plugin:failed', { id, error });
      console.error(error);
    }
  }

  /**
   * Unload a plugin by ID
   * @param {string} id - Plugin ID
   */
  async unloadPlugin(id) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Plugin ID must be a non-empty string');
      error.name = 'PluginManagerError';
      await this.emit('plugin:validation-failed', { id, error });
      console.error(error);
      return;
    }

    if (!this[ACTIVE_PLUGINS].has(id)) {
      console.warn(`[PluginManager] Plugin "${id}" is not loaded`);
      return;
    }

    const metadata = this[PLUGIN_METADATA].get(id);
    if (metadata) {
      metadata.state = PluginState.UNLOADING;
    }

    await this.emit('plugin:unloading', { id });

    try {
      const plugin = this[ACTIVE_PLUGINS].get(id);

      // Call plugin View lifecycle hook
      if (plugin && typeof plugin.onUnload === 'function') {
        await plugin.onUnload(this[PLUGIN_CONTEXT]);
      }

      // Cleanup CSS/JS resources from DOM
      this.cleanupPluginResources(id);

      // Unregister from registry
      await registry.unregister(id, this[PLUGIN_CONTEXT]);

      // Remove from active plugins
      this[ACTIVE_PLUGINS].delete(id);

      // Update metadata
      if (metadata) {
        metadata.state = PluginState.UNLOADED;
      }

      console.log(`[PluginManager] Successfully unloaded plugin: ${id}`);
      await this.emit('plugin:unloaded', { id });
    } catch (error) {
      console.error(`[PluginManager] Failed to unload plugin "${id}":`, error);

      if (metadata) {
        metadata.state = PluginState.FAILED;
        metadata.error = error;
      }

      await this.emit('plugin:unload-failed', { id, error });
      console.error(error);
    }
  }

  /**
   * Reload a plugin (unload then load)
   * @param {string} id - Plugin ID
   */
  async reloadPlugin(id) {
    const metadata = this[PLUGIN_METADATA].get(id);
    const manifest = metadata && metadata.manifest;

    await this.unloadPlugin(id);
    await this.loadPlugin(id, manifest);
  }

  /**
   * Update a plugin with a new manifest/version
   * Properly handles uninstall lifecycle before loading new version
   * @param {string} id - Plugin ID
   * @param {Object} newManifest - New plugin manifest (optional, will fetch if not provided)
   */
  async updatePlugin(id, newManifest = null) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Plugin ID must be a non-empty string');
      error.name = 'PluginManagerError';
      await this.emit('plugin:validation-failed', { id, error });
      console.error(error);
      return;
    }

    const oldMetadata = this[PLUGIN_METADATA].get(id);
    const oldVersion = (oldMetadata && oldMetadata.version) || 'unknown';

    await this.emit('plugin:updating', {
      id,
      oldVersion,
      newVersion: (newManifest && newManifest.version) || 'unknown',
    });

    try {
      // Unload existing plugin (this calls uninstall hook)
      if (this[ACTIVE_PLUGINS].has(id)) {
        await this.unloadPlugin(id);
      }

      // Load new version (this calls install hook)
      await this.loadPlugin(id, newManifest);

      const newVersion =
        (this[PLUGIN_METADATA].get(id) &&
          this[PLUGIN_METADATA].get(id).version) ||
        'unknown';

      if (__DEV__) {
        console.log(
          `[PluginManager] Updated plugin: ${id} (${oldVersion} → ${newVersion})`,
        );
      }

      await this.emit('plugin:updated', { id, oldVersion, newVersion });
    } catch (error) {
      console.error(`[PluginManager] Failed to update plugin "${id}":`, error);
      await this.emit('plugin:update-failed', { id, error });
      console.error(error);
    }
  }

  /**
   * Install a plugin (one-time setup, calls install() lifecycle hook)
   * @param {string} id - Plugin ID
   * @returns {Promise<boolean>} True if installed successfully
   */
  async installPlugin(id) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Plugin ID must be a non-empty string');
      error.name = 'PluginManagerError';
      await this.emit('plugin:validation-failed', { id, error });
      console.error(error);
      return;
    }

    await this.emit('plugin:installing', { id });

    try {
      const result = await registry.installPlugin(id);
      if (result) {
        if (__DEV__) {
          console.log(`[PluginManager] Installed plugin: ${id}`);
        }
        await this.emit('plugin:installed', { id });
      }
      return result;
    } catch (error) {
      console.error(`[PluginManager] Failed to install plugin "${id}":`, error);
      await this.emit('plugin:install-failed', { id, error });
      console.error(error);
    }
  }

  /**
   * Uninstall a plugin (one-time teardown, calls uninstall() lifecycle hook)
   * @param {string} id - Plugin ID
   * @returns {Promise<boolean>} True if uninstalled successfully
   */
  async uninstallPlugin(id) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      const error = new Error('Plugin ID must be a non-empty string');
      error.name = 'PluginManagerError';
      await this.emit('plugin:validation-failed', { id, error });
      console.error(error);
      return;
    }

    await this.emit('plugin:uninstalling', { id });

    try {
      const result = await registry.uninstallPlugin(id);
      if (result) {
        if (__DEV__) {
          console.log(`[PluginManager] Uninstalled plugin: ${id}`);
        }
        await this.emit('plugin:uninstalled', { id });
      }
      return result;
    } catch (error) {
      console.error(
        `[PluginManager] Failed to uninstall plugin "${id}":`,
        error,
      );
      await this.emit('plugin:uninstall-failed', { id, error });
      console.error(error);
    }
  }

  /**
   * Check if a namespace is loaded (at least one plugin from it is registered)
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
      error.name = 'PluginManagerError';
      await this.emit('namespace:validation-failed', { ns, error });
      console.error(error);
      return;
    }

    await this.emit('namespace:loading', { ns });

    try {
      if (__DEV__) {
        console.log(`[PluginManager] loadNamespace called for: ${ns}`);
      }
      const plugins = registry.getDefinitions(ns);
      if (!plugins) {
        console.warn(`[PluginManager] No plugins found for namespace: ${ns}`);
        return;
      }
      if (__DEV__) {
        console.log(
          `[PluginManager] Found ${plugins.size} plugins for namespace ${ns}`,
        );
      }

      for (const plugin of plugins) {
        if (__DEV__) {
          console.log(
            `[PluginManager] Loading plugin from namespace: ${plugin.id}`,
          );
        }
        // Wrap init/destroy for the standard register method
        const pluginInstance = {
          ...plugin,
          init: async reg => {
            if (__DEV__) {
              console.log(`[PluginManager] Initializing plugin: ${plugin.id}`);
            }
            if (typeof plugin.init === 'function') {
              await plugin.init(reg, this[PLUGIN_CONTEXT]);
            } else if (__DEV__) {
              console.warn(
                `[PluginManager] Plugin ${plugin.id} has no 'init' method`,
              );
            }
          },
          destroy: async reg => {
            if (__DEV__) {
              console.log(`[PluginManager] Destroying plugin: ${plugin.id}`);
            }
            if (typeof plugin.destroy === 'function') {
              await plugin.destroy(reg, this[PLUGIN_CONTEXT]);
            } else if (__DEV__) {
              console.warn(
                `[PluginManager] Plugin ${plugin.id} has no 'destroy' method`,
              );
            }
          },
        };

        await registry.register(plugin.id, pluginInstance);
      }

      if (__DEV__) {
        console.log(`[PluginManager] Loaded namespace: ${ns}`);
      }
      await this.emit('namespace:loaded', { ns });
    } catch (error) {
      console.error(`[PluginManager] Failed to load namespace "${ns}":`, error);
      await this.emit('namespace:load-failed', { ns, error });
      console.error(error);
    }
  }

  /**
   * Unload all plugins for a given namespace (runtime deactivation)
   * @param {string} ns - Namespace to unload
   */
  async unloadNamespace(ns) {
    if (typeof ns !== 'string' || ns.trim().length === 0) {
      const error = new Error('Namespace must be a non-empty string');
      error.name = 'PluginManagerError';
      await this.emit('namespace:validation-failed', { ns, error });
      console.error(error);
      return;
    }

    await this.emit('namespace:unloading', { ns });

    try {
      const plugins = registry.getDefinitions(ns);
      if (!plugins) return;

      for (const plugin of plugins) {
        await registry.unregister(plugin.id);
      }

      if (__DEV__) {
        console.log(`[PluginManager] Unloaded namespace: ${ns}`);
      }
      await this.emit('namespace:unloaded', { ns });
    } catch (error) {
      console.error(
        `[PluginManager] Failed to unload namespace "${ns}":`,
        error,
      );
      await this.emit('namespace:unload-failed', { ns, error });
      console.error(error);
    }
  }

  /**
   * Get plugin by ID
   * @param {string} id - Plugin ID
   * @returns {Object|null} Plugin instance or null
   */
  getPlugin(id) {
    return this[ACTIVE_PLUGINS].get(id) || null;
  }

  /**
   * Get all loaded plugins
   * @returns {Array<Object>} Array of plugin instances
   */
  getAllPlugins() {
    return Array.from(this[ACTIVE_PLUGINS].values());
  }

  /**
   * Get plugin metadata
   * @param {string} id - Plugin ID
   * @returns {PluginMetadata|null}
   */
  getPluginMetadata(id) {
    return this[PLUGIN_METADATA].get(id) || null;
  }

  /**
   * Get all plugin metadata
   * @returns {Array<PluginMetadata>}
   */
  getAllPluginMetadata() {
    return Array.from(this[PLUGIN_METADATA].values());
  }

  /**
   * Check if plugin is loaded
   * @param {string} id - Plugin ID
   * @returns {boolean}
   */
  isPluginLoaded(id) {
    return this[ACTIVE_PLUGINS].has(id);
  }

  /**
   * Get plugin state
   * @param {string} id - Plugin ID
   * @returns {string|null} Plugin state or null
   */
  getPluginState(id) {
    const metadata = this[PLUGIN_METADATA].get(id);
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
            `[PluginManager] Event handler error for "${eventType}":`,
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
   * Clean up resources
   */
  async destroy() {
    if (__DEV__) {
      console.log('[PluginManager] Destroying...');
    }

    await this.emit('manager:destroying');

    // Unload all plugins
    const pluginIds = Array.from(this[ACTIVE_PLUGINS].keys());
    await Promise.all(pluginIds.map(id => this.unloadPlugin(id)));

    // Clear all internal state
    this[ACTIVE_PLUGINS].clear();
    this[PLUGIN_METADATA].clear();
    this[PLUGIN_CSS_ENTRY_POINTS].clear();
    this[LOADED_VERSIONS].clear();
    this[PLUGIN_CONTEXT] = null;
    this[INITIALIZED] = false;
    this[PLUGIN_MANAGER_INIT] = null;

    await this.emit('manager:destroyed');

    // Clear all event handlers last
    this[EVENT_HANDLERS].clear();

    if (__DEV__) {
      console.log('[PluginManager] Destroyed');
    }
  }
}
