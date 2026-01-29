/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Private property symbols
const PLUGINS = Symbol('plugins');
const SLOTS = Symbol('slots');
const HOOKS = Symbol('hooks');
const SCHEMAS = Symbol('schemas');

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
    this[HOOKS] = new Map(); // Map<hookId, Set<callback>>
    this[SCHEMAS] = new Map(); // Map<schemaId, Set<extender>>
  }

  // =========================================================================
  // Plugin Management
  // =========================================================================

  /**
   * Register a plugin (idempotent, supports async init)
   * @param {string} pluginId - Plugin identifier
   * @param {Object} plugin - { name, init, destroy }
   * @returns {Promise<this>}
   */
  async register(pluginId, plugin) {
    if (this[PLUGINS].has(pluginId)) return this;

    this[PLUGINS].set(pluginId, { ...plugin, id: pluginId });
    if (typeof plugin.init === 'function') {
      await plugin.init(this);
    }
    return this;
  }

  /**
   * Unregister a plugin by ID (supports async destroy)
   * @param {string} pluginId - Plugin identifier
   * @returns {Promise<this>}
   */
  async unregister(pluginId) {
    const plugin = this[PLUGINS].get(pluginId);
    if (plugin && typeof plugin.destroy === 'function') {
      await plugin.destroy(this);
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

  // =========================================================================
  // Slot Management (UI extension points)
  // =========================================================================

  /**
   * Register a component for a slot (idempotent)
   * @param {string} slotId - Slot identifier
   * @param {React.Component} component - Component to render
   * @param {Object} options - { order: number, ... }
   */
  registerSlot(slotId, component, options = {}) {
    if (!this[SLOTS].has(slotId)) {
      this[SLOTS].set(slotId, new Map());
    }
    const slotMap = this[SLOTS].get(slotId);
    if (!slotMap.has(component)) {
      slotMap.set(component, { order: 0, ...options });
    }
    return this;
  }

  /** Unregister a component from a slot */
  unregisterSlot(slotId, component) {
    const slotMap = this[SLOTS].get(slotId);
    if (slotMap && typeof slotMap.delete === 'function') {
      slotMap.delete(component);
    }
    return this;
  }

  /** Get components for a slot (sorted by order) */
  getSlot(slotId) {
    const slotMap = this[SLOTS].get(slotId);
    if (!slotMap) return [];

    return Array.from(slotMap.entries())
      .map(([component, options]) => ({ component, ...options }))
      .sort((a, b) => a.order - b.order);
  }

  // =========================================================================
  // Hook Management (logic extension points)
  // =========================================================================

  /**
   * Register a hook callback (idempotent - Set handles deduplication)
   * @param {string} hookId - Hook identifier
   * @param {Function} callback - Callback function (can be async)
   */
  registerHook(hookId, callback) {
    if (!this[HOOKS].has(hookId)) {
      this[HOOKS].set(hookId, new Set());
    }
    const callbacks = this[HOOKS].get(hookId);
    if (callbacks && typeof callbacks.add === 'function') {
      callbacks.add(callback);
    }
    return this;
  }

  /** Unregister a hook callback */
  unregisterHook(hookId, callback) {
    const callbacks = this[HOOKS].get(hookId);
    if (callbacks && typeof callbacks.delete === 'function') {
      callbacks.delete(callback);
    }
    return this;
  }

  /**
   * Execute all callbacks for a hook sequentially
   * @param {string} hookId - Hook identifier
   * @param {...any} args - Arguments to pass to callbacks
   * @returns {Promise<Array>} Results from all callbacks
   */
  async executeHook(hookId, ...args) {
    const callbacks = this[HOOKS].get(hookId);
    if (!callbacks) return [];

    const results = [];
    for (const callback of callbacks) {
      try {
        results.push(await callback(...args));
      } catch (error) {
        console.error(`[PluginRegistry] Hook "${hookId}" error:`, error);
      }
    }
    return results;
  }

  // =========================================================================
  // Schema Management (Zod schema extensions)
  // =========================================================================

  /**
   * Register a schema extender (idempotent)
   * @param {string} schemaId - Schema identifier
   * @param {Function} extender - (schema, validator) => extendedSchema
   */
  registerSchema(schemaId, extender) {
    if (!this[SCHEMAS].has(schemaId)) {
      this[SCHEMAS].set(schemaId, new Set());
    }
    this[SCHEMAS].get(schemaId).add(extender);
    return this;
  }

  /** Unregister a schema extender */
  unregisterSchema(schemaId, extender) {
    const extenders = this[SCHEMAS].get(schemaId);
    if (extenders && typeof extenders.delete === 'function') {
      extenders.delete(extender);
    }
    return this;
  }

  /**
   * Extend a schema with all registered extenders
   * @param {string} schemaId - Schema identifier
   * @param {ZodSchema} baseSchema - Base Zod schema
   * @param {Object} validator - Zod instance
   * @returns {ZodSchema} Extended schema
   */
  extendSchema(schemaId, baseSchema, validator) {
    const extenders = this[SCHEMAS].get(schemaId);
    if (!extenders) return baseSchema;

    let schema = baseSchema;
    for (const extender of extenders) {
      try {
        schema = extender(schema, validator);
      } catch (error) {
        console.error(`[PluginRegistry] Schema "${schemaId}" error:`, error);
      }
    }
    return schema;
  }

  // =========================================================================
  // Utility
  // =========================================================================

  /** Clear all registrations (useful for testing) */
  clear() {
    this[PLUGINS].clear();
    this[SLOTS].clear();
    this[HOOKS].clear();
    this[SCHEMAS].clear();
    return this;
  }
}

// Export singleton
export const registry = new PluginRegistry();
export default registry;
