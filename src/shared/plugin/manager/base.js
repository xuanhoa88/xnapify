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
import { registry } from '../registry';

export const INITIALIZED = Symbol('__rsk.initializedPlugins__');
export const ACTIVE_PLUGINS = Symbol('__rsk.activePlugins__');
export const PLUGIN_CONTEXT = Symbol('__rsk.pluginContext__');
export const PLUGIN_METADATA = Symbol('__rsk.pluginMetadata__');
export const EVENT_HANDLERS = Symbol('__rsk.pluginEventHandlers__');
export const LOADED_VERSIONS = Symbol('__rsk.loadedPluginVersions__');
export const PLUGIN_CSS_FILES = Symbol('__rsk.pluginCssFiles__');

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
    this[PLUGIN_CONTEXT] = null;
    this[ACTIVE_PLUGINS] = new Map(); // id -> plugin instance
    this[PLUGIN_METADATA] = new Map(); // id -> metadata
    this[EVENT_HANDLERS] = new Map(); // eventType -> Set of handlers
    this[PLUGIN_CSS_FILES] = new Map(); // id -> cssFiles array
    this[INITIALIZED] = false;
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
    this[INITIALIZED] = true;
  }

  /**
   * Fetch and load all active plugins from API
   */
  async fetchAll() {
    try {
      const response = await this[PLUGIN_CONTEXT].fetch('/api/plugins');
      const plugins =
        response.data && Array.isArray(response.data.plugins)
          ? response.data.plugins
          : [];
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

      this.emit('plugins:initialized', {
        total: plugins.length,
        loaded: results.filter(r => r.status === 'fulfilled').length,
        failed: failures.length,
      });
    } catch (error) {
      console.error('[PluginManager] Failed to fetch plugins:', error);
      this.emit('plugins:init-failed', { error });
      throw error;
    }
  }

  /**
   * Load a single plugin by ID
   * @param {string} id - Plugin ID
   * @param {Object} manifest - Optional plugin manifest
   */
  async loadPlugin(id, manifest = null) {
    if (!id || typeof id !== 'string') {
      const error = new Error('Plugin ID must be a non-empty string');
      error.name = 'PluginManagerError';
      throw error;
    }

    // Check if already loaded
    if (this[ACTIVE_PLUGINS].has(id)) {
      console.warn(`[PluginManager] Plugin "${id}" is already loaded`);
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

    this.emit('plugin:loading', { id });

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

      // Load the plugin via MF container
      let plugin = await this.executePlugin(id, manifest, containerName);

      // Handle ES module default export
      plugin = plugin.default || plugin;

      // Validate plugin structure
      this.validatePluginStructure(plugin);

      console.log(`[PluginManager] Defining plugin in registry: ${id}`);
      // Register with registry
      await registry.define(plugin, this[PLUGIN_CONTEXT]);

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

      console.log(`[PluginManager] Successfully loaded plugin: ${id}`);
      this.emit('plugin:loaded', { id, plugin });

      // Store CSS files from manifest if available (for SSR injection)
      if (serverManifest && Array.isArray(serverManifest.cssFiles)) {
        this[PLUGIN_CSS_FILES].set(
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

      this.emit('plugin:failed', { id, error });
      throw error;
    }
  }

  /**
   * Get all plugin CSS URLs for SSR injection
   * @returns {Array<string>} Array of CSS URLs
   */
  getPluginCssUrls() {
    const urls = [];
    for (const [, cssFiles] of this[PLUGIN_CSS_FILES]) {
      urls.push(...cssFiles);
    }
    return urls;
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
   * @param {string} code - Plugin code (or URL if loading from server)
   * @param {Object} manifest - Plugin manifest
   * @param {string} internalId - Internal plugin ID (folder name)
   * @returns {Object} Plugin instance
   */
  async executePlugin(id, code, manifest, internalId) {
    try {
      if (typeof this.loadPluginModule !== 'function') {
        const error = new Error(
          'PluginManager must implement loadPluginModule',
        );
        error.name = 'PluginManagerError';
        throw error;
      }

      const pluginModule = await this.loadPluginModule(
        id,
        code,
        manifest,
        internalId,
      );

      if (!pluginModule) {
        const error = new Error('Plugin module did not export a valid object');
        error.name = 'PluginManagerError';
        throw error;
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

      console.log(
        `[PluginManager] Loaded plugin module for ${id}:`,
        typeof plugin,
        'Keys:',
        Object.keys(plugin || {}),
      );

      if (!plugin) {
        const error = new Error(
          'Plugin module did not export a valid plugin object',
        );
        error.name = 'PluginManagerError';
        throw error;
      }

      return plugin;
    } catch (error) {
      const err = new Error(`Plugin execution failed: ${error.message}`);
      err.name = 'PluginManagerError';
      throw err;
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
   * Unload a plugin by ID
   * @param {string} id - Plugin ID
   */
  async unloadPlugin(id) {
    if (!this[ACTIVE_PLUGINS].has(id)) {
      console.warn(`[PluginManager] Plugin "${id}" is not loaded`);
      return;
    }

    const metadata = this[PLUGIN_METADATA].get(id);
    if (metadata) {
      metadata.state = PluginState.UNLOADING;
    }

    this.emit('plugin:unloading', { id });

    try {
      const plugin = this[ACTIVE_PLUGINS].get(id);

      // Call plugin lifecycle hook
      if (typeof plugin.onUnload === 'function') {
        await plugin.onUnload(this[PLUGIN_CONTEXT]);
      }

      // Unregister from registry
      await registry.unregister(id);

      // Remove from active plugins
      this[ACTIVE_PLUGINS].delete(id);

      // Update metadata
      if (metadata) {
        metadata.state = PluginState.UNLOADED;
      }

      console.log(`[PluginManager] Successfully unloaded plugin: ${id}`);
      this.emit('plugin:unloaded', { id });
    } catch (error) {
      console.error(`[PluginManager] Failed to unload plugin "${id}":`, error);

      if (metadata) {
        metadata.state = PluginState.FAILED;
        metadata.error = error;
      }

      this.emit('plugin:unload-failed', { id, error });
      throw error;
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
   * Event emitter - emit an event
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  emit(eventType, data) {
    const handlers = this[EVENT_HANDLERS].get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[PluginManager] Event handler error:`, error);
        }
      });
    }
  }

  /**
   * Event emitter - subscribe to an event
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(eventType, handler) {
    if (!this[EVENT_HANDLERS].has(eventType)) {
      this[EVENT_HANDLERS].set(eventType, new Set());
    }

    this[EVENT_HANDLERS].get(eventType).add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this[EVENT_HANDLERS].get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  /**
   * Event emitter - unsubscribe from an event
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler
   */
  off(eventType, handler) {
    const handlers = this[EVENT_HANDLERS].get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Clean up resources
   */
  async destroy() {
    // Unload all plugins
    const pluginIds = Array.from(this[ACTIVE_PLUGINS].keys());
    await Promise.all(pluginIds.map(id => this.unloadPlugin(id)));

    // Clear all event handlers
    this[EVENT_HANDLERS].clear();

    // Clear metadata
    this[PLUGIN_METADATA].clear();

    console.log('[PluginManager] Destroyed');
  }
}
