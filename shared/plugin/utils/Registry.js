/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { composeMiddleware } from '@shared/utils/composer';

import Hook from './Hook';

// Private property symbols
const PLUGINS = Symbol('__rsk.pluginsList__');
const SLOTS = Symbol('__rsk.pluginSlots__');
const DEFINITIONS = Symbol('__rsk.pluginDefinitions__');
const LISTENERS = Symbol('__rsk.pluginListeners__');
const HOOKS = Symbol('__rsk.pluginHooks__');
const REGISTRATIONS = Symbol('__rsk.pluginRegistrations__');

/**
 * PluginRegistry - Manages plugin registrations, UI slots, hooks, and schema extensions
 *
 * All registration methods are idempotent - safe to call multiple times.
 * Plugin init/destroy and hooks support async/await.
 */
class PluginRegistry {
  constructor() {
    this[PLUGINS] = new Map(); // Map<id, plugin>
    this[SLOTS] = new Map(); // Map<slotId, Map<component, options>>
    this[HOOKS] = new Hook(); // Specialized hook manager
    this[DEFINITIONS] = new Map(); // Map<namespace, Array<definition>>
    this[LISTENERS] = new Set(); // Set<callback>
    this[REGISTRATIONS] = new Map(); // Map<pluginId, { slots: [], hooks: [] }>
  }

  // =========================================================================
  // Plugin Management
  // =========================================================================

  /**
   * Register a plugin (idempotent, supports async init)
   * @param {string} pluginId - Plugin identifier
   * @param {Object} plugin - { name, init, destroy }
   * @param {Object} context - Optional plugin context (i18n, store, etc.)
   * @returns {Promise<this>}
   */
  async register(pluginId, plugin, context) {
    if (this[PLUGINS].has(pluginId)) return this;

    this[PLUGINS].set(pluginId, { ...plugin, id: pluginId });
    if (typeof plugin.init === 'function') {
      await plugin.init(this, context);
    }
    return this;
  }

  /**
   * Unregister a plugin by ID (supports async destroy)
   * Automatically cleans up all registrations made by this plugin
   * @param {string} pluginId - Plugin identifier
   * @param {Object} context - Optional plugin context
   * @returns {Promise<this>}
   */
  async unregister(pluginId, context) {
    // Clean up all registrations before calling destroy
    // eslint-disable-next-line no-underscore-dangle
    this._clearPluginRegistrations(pluginId);

    const plugin = this[PLUGINS].get(pluginId);
    if (plugin && typeof plugin.destroy === 'function') {
      await plugin.destroy(this, context);
    }
    this[PLUGINS].delete(pluginId);
    return this;
  }

  /** Check if a plugin is registered */
  has(pluginId) {
    return this[PLUGINS].has(pluginId);
  }

  /** Get a plugin by ID */
  get(pluginId) {
    return this[PLUGINS].get(pluginId);
  }

  /** Get list of registered plugin IDs */
  list() {
    return Array.from(this[PLUGINS].keys());
  }

  /**
   * Track a registration for a plugin (internal helper)
   * @param {string} pluginId - Plugin that owns this registration
   * @param {string} type - 'slots' | 'hooks' | 'schemas'
   * @param {Object} data - Registration data to track
   */
  _trackRegistration(pluginId, type, data) {
    if (!pluginId) return;

    if (!this[REGISTRATIONS].has(pluginId)) {
      this[REGISTRATIONS].set(pluginId, { slots: [], hooks: [] });
    }
    const reg = this[REGISTRATIONS].get(pluginId);
    if (reg[type]) {
      reg[type].push(data);
    }
  }

  /**
   * Clear all registrations made by a plugin
   * @param {string} pluginId - Plugin to clear registrations for
   */
  _clearPluginRegistrations(pluginId) {
    const reg = this[REGISTRATIONS].get(pluginId);
    if (!reg) return;

    // Clear slots
    for (const { slotId, component } of reg.slots) {
      this.unregisterSlot(slotId, component);
    }

    // Clear hooks (includes schema extenders)
    this[HOOKS].clear(pluginId);

    if (__DEV__) {
      const total = reg.slots.length + reg.hooks.length;
      if (total > 0) {
        console.log(
          `[PluginRegistry] Cleared ${total} registrations for plugin: ${pluginId}`,
        );
      }
    }

    // Remove tracking entry
    this[REGISTRATIONS].delete(pluginId);
  }

  // =========================================================================
  // Definition & Namespace Management
  // =========================================================================

  /**
   * Register a plugin definition using manifest metadata
   * Namespaces and identity come from the manifest's rsk.subscribe, rsk.name, and description fields.
   * @param {Object} definition - Plugin definition object (init, destroy, translations)
   * @param {Object} context - Plugin context
   * @param {Object} manifest - Plugin manifest from package.json
   */
  define(definition, context, manifest) {
    if (!manifest || !manifest.rsk) {
      console.warn(
        '[PluginRegistry] Invalid plugin definition: missing manifest or rsk key',
      );
      return this;
    }

    const namespaces = manifest.rsk.subscribe || [];
    const pluginId = manifest.name;
    const meta = { description: manifest.description };

    if (!pluginId) {
      console.warn('[PluginRegistry] Plugin definition missing name');
      return this;
    }

    if (namespaces.length === 0) {
      console.warn(
        `[PluginRegistry] Plugin "${pluginId}" has no subscribed namespaces`,
      );
    }

    for (const ns of namespaces) {
      if (!this[DEFINITIONS].has(ns)) {
        this[DEFINITIONS].set(ns, new Set());
      }

      // Store the full definition wrapper
      const definitions = this[DEFINITIONS].get(ns);
      const newDef = {
        ...definition,
        ...meta,
        context,
        id: pluginId,
      };

      // Remove existing definition with same ID if present (update/overwrite)
      for (const def of definitions) {
        if (def.id === pluginId) {
          definitions.delete(def);
          break;
        }
      }

      definitions.add(newDef);
    }

    return this;
  }

  /**
   * Find a plugin definition by ID across all namespaces
   * @param {string} id - Plugin ID
   * @returns {Object|null} Plugin definition or null
   */
  findDefinition(id) {
    for (const [, definitions] of this[DEFINITIONS]) {
      for (const def of definitions) {
        if (def.id === id) return def;
      }
    }
    return null;
  }

  /**
   * Remove a plugin definition by ID across all namespaces
   * @param {string} id - Plugin ID
   * @returns {boolean} True if any definition was removed
   */
  undefine(id) {
    let removed = false;
    for (const [, definitions] of this[DEFINITIONS]) {
      for (const def of definitions) {
        if (def.id === id) {
          definitions.delete(def);
          removed = true;
          // Don't break here, as plugin might be defined in multiple namespaces
        }
      }
    }
    return removed;
  }

  /**
   * Get all plugin definitions for a namespace
   * @param {string} ns - Namespace
   * @returns {Set|null} Set of plugin definitions or null
   */
  getDefinitions(ns) {
    return this[DEFINITIONS].get(ns) || null;
  }

  /**
   * Install a specific plugin by ID
   * Calls the install() lifecycle hook if present
   * @param {string} id - Plugin ID
   * @returns {Promise<boolean>} True if installed successfully
   */
  async installPlugin(id) {
    const definition = this.findDefinition(id);
    if (!definition) {
      console.warn(`[PluginRegistry] Cannot install: plugin "${id}" not found`);
      return false;
    }

    // Call install hook if present
    if (typeof definition.install === 'function') {
      try {
        await definition.install(definition.context);
        if (__DEV__) {
          console.log(`[PluginRegistry] Installed plugin: ${id}`);
        }
      } catch (error) {
        console.error(
          `[PluginRegistry] Failed to install plugin "${id}":`,
          error,
        );
        throw error;
      }
    }

    return true;
  }

  /**
   * Uninstall a specific plugin by ID
   * Calls the uninstall() lifecycle hook if present
   * @param {string} id - Plugin ID
   * @returns {Promise<boolean>} True if uninstalled successfully
   */
  async uninstallPlugin(id) {
    const definition = this.findDefinition(id);
    if (!definition) {
      console.warn(
        `[PluginRegistry] Cannot uninstall: plugin "${id}" not found`,
      );
      return false;
    }

    // Call uninstall hook if present
    if (typeof definition.uninstall === 'function') {
      try {
        await definition.uninstall(definition.context);
        if (__DEV__) {
          console.log(`[PluginRegistry] Uninstalled plugin: ${id}`);
        }
      } catch (error) {
        console.error(
          `[PluginRegistry] Failed to uninstall plugin "${id}":`,
          error,
        );
        throw error;
      }
    }

    return true;
  }

  /**
   * Update a specific plugin by ID
   * Unloads current instance and reloads for new version
   * @param {string} id - Plugin ID
   * @returns {Promise<boolean>} True if updated successfully
   */
  async updatePlugin(id) {
    if (__DEV__) {
      console.log(`[PluginRegistry] Updating plugin: ${id}`);
    }

    // Find definition
    const definition = this.findDefinition(id);
    if (!definition) {
      console.warn(`[PluginRegistry] Cannot load: plugin "${id}" not found`);
      return false;
    }

    // Unload if currently loaded
    if (this.has(id)) {
      await this.unregister(id, definition.context);
    }

    // Reload plugin
    return this.register(id, definition, definition.context);
  }

  // =========================================================================
  // Slot Management (UI extension points)
  // =========================================================================

  /**
   * Register a component for a slot (idempotent)
   * @param {string} slotId - Slot identifier
   * @param {React.Component} component - Component to render
   * @param {Object} options - { order: number, pluginId: string, ... }
   */
  registerSlot(slotId, component, options = {}) {
    const { pluginId, ...slotOptions } = options;
    if (!this[SLOTS].has(slotId)) {
      this[SLOTS].set(slotId, new Map());
    }
    const slotMap = this[SLOTS].get(slotId);
    if (!slotMap.has(component)) {
      slotMap.set(component, { order: 0, ...slotOptions });
      // eslint-disable-next-line no-underscore-dangle
      this._trackRegistration(pluginId, 'slots', { slotId, component });
      this.notify();
    }
    return this;
  }

  /** Unregister a component from a slot */
  unregisterSlot(slotId, component) {
    const slotMap = this[SLOTS].get(slotId);
    if (slotMap && typeof slotMap.delete === 'function') {
      slotMap.delete(component);
      this.notify();
    }
    return this;
  }

  /** Get components for a slot (sorted by order) */
  getSlot(slotId) {
    const slotMap = this[SLOTS].get(slotId);
    if (!slotMap) return [];

    return Array.from(slotMap.entries())
      .map(([component, options]) => ({ ...options, component }))
      .sort((a, b) => a.order - b.order);
  }

  // =========================================================================
  // Hook Management (logic extension points)
  // =========================================================================

  /**
   * Register a hook callback (idempotent - Set handles deduplication)
   * @param {string} hookId - Hook identifier
   * @param {Function} callback - Callback function (can be async)
   * @param {string} [pluginId] - Optional plugin ID for auto-cleanup
   */
  registerHook(hookId, callback, pluginId) {
    this[HOOKS].register(hookId, callback, pluginId);
    return this;
  }

  unregisterHook(hookId, callback) {
    this[HOOKS].unregister(hookId, callback);
    return this;
  }

  /**
   * Check if a hook has any registered callbacks
   * @param {string} hookId - Hook identifier
   * @returns {boolean}
   */
  hasHook(hookId) {
    return this[HOOKS].has(hookId);
  }

  /**
   * Execute all callbacks for a hook sequentially
   * @param {string} hookId - Hook identifier
   * @param {...any} args - Arguments to pass to callbacks
   * @returns {Promise<Array>} Results from all callbacks
   */
  async executeHook(hookId, ...args) {
    return this[HOOKS].execute(hookId, ...args);
  }

  /**
   * Execute all callbacks for a hook in parallel
   * @param {string} hookId - Hook identifier
   * @param {...any} args - Arguments to pass to callbacks
   * @returns {Promise<Array>} Results from all callbacks
   */
  async executeHookParallel(hookId, ...args) {
    return this[HOOKS].executeParallel(hookId, ...args);
  }

  // =========================================================================
  // IPC & Middleware Utility
  // =========================================================================

  /**
   * Compose multiple middleware functions into a single handler.
   * Useful for IPC hooks where you want validation, auth, etc., before the main logic.
   *
   * @param {...Function} middlewares - Functions with signature `(data, context, next)`
   * @returns {Function} Composed handler with signature `(data, context)`
   */
  createPipeline(...middlewares) {
    return composeMiddleware(...middlewares);
  }

  // =========================================================================
  // Utility
  // =========================================================================

  /** Clear all registrations (useful for testing) */
  clear() {
    this[PLUGINS].clear();
    this[SLOTS].clear();
    this[HOOKS].clear();
    this[DEFINITIONS].clear();
    this.notify();
    return this;
  }

  /**
   * Subscribe to registry changes
   * @param {Function} callback - () => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this[LISTENERS].add(callback);
    return () => {
      this[LISTENERS].delete(callback);
    };
  }

  /** Notify all listeners of changes */
  notify() {
    this[LISTENERS].forEach(callback => callback());
  }
}

// Export singleton
export const registry = new PluginRegistry();

// Export class
export default PluginRegistry;
