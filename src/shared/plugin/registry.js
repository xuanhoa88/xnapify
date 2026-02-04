/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Private property symbols
const PLUGINS = Symbol('__rsk.pluginsList__');
const SLOTS = Symbol('__rsk.pluginSlots__');
const HOOKS = Symbol('__rsk.pluginHooks__');
const SCHEMAS = Symbol('__rsk.pluginSchemas__');
const DEFINITIONS = Symbol('__rsk.pluginDefinitions__');
const LISTENERS = Symbol('__rsk.pluginListeners__');

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
    this[DEFINITIONS] = new Map(); // Map<namespace, Array<definition>>
    this[LISTENERS] = new Set(); // Set<callback>
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
  // Definition & Namespace Management
  // =========================================================================

  /**
   * Register a plugin definition (from register() export)
   * Expected format: { register: () => [{ namespace }, { id, ... }], install, uninstall }
   * @param {Object} definition - Plugin definition object
   * @param {Object} context - Plugin context
   */
  define(definition, context) {
    if (typeof definition.register !== 'function') {
      console.warn(
        '[PluginRegistry] Invalid plugin definition: missing register()',
      );
      return this;
    }

    const [ns, id, meta] = definition.register(context);

    if (!ns) {
      console.warn('[PluginRegistry] Plugin definition missing ns (namespace)');
      return this;
    }

    if (!this[DEFINITIONS].has(ns)) {
      this[DEFINITIONS].set(ns, new Set());
    }

    // Store the full definition wrapper
    const definitions = this[DEFINITIONS].get(ns);
    const newDef = {
      ...meta,
      id,
      context,
      name: meta.name || id,
      install: definition.install,
      uninstall: definition.uninstall,
      mount: definition.mount,
      unmount: definition.unmount,
    };

    // Remove existing definition with same ID if present (update/overwrite)
    for (const def of definitions) {
      if (def.id === id) {
        definitions.delete(def);
        break;
      }
    }

    definitions.add(newDef);

    return this;
  }

  /**
   * Install all plugins for a given namespace
   * @param {string} ns - Namespace to install
   */
  async installNamespace(ns) {
    console.log(`[PluginRegistry] installNamespace called for: ${ns}`);
    const plugins = this[DEFINITIONS].get(ns);
    if (!plugins) {
      console.warn(`[PluginRegistry] No plugins found for namespace: ${ns}`);
      return;
    }
    console.log(
      `[PluginRegistry] Found ${plugins.size} plugins for namespace ${ns}`,
    );

    for (const plugin of plugins) {
      console.log(
        `[PluginRegistry] Registering plugin from namespace: ${plugin.id}`,
      );
      // 1. Register the plugin instance
      // We wrap the mount/unmount into init/destroy for the standard register method
      const pluginInstance = {
        ...plugin,
        init: async reg => {
          console.log(`[PluginRegistry] Initializing plugin: ${plugin.id}`);
          if (typeof plugin.mount === 'function') {
            await plugin.mount(reg);
          } else {
            console.warn(
              `[PluginRegistry] Plugin ${plugin.id} has no mount method`,
            );
          }
        },
        destroy: async reg => {
          if (typeof plugin.unmount === 'function') {
            await plugin.unmount(reg);
          }
        },
      };

      await this.register(plugin.id, pluginInstance);
    }
  }

  /**
   * Uninstall all plugins for a given namespace
   * @param {string} ns - Namespace to uninstall
   */
  async uninstallNamespace(ns) {
    const plugins = this[DEFINITIONS].get(ns);
    if (!plugins) return;

    for (const plugin of plugins) {
      await this.unregister(plugin.id);
    }
  }

  /**
   * Check if a namespace is installed (at least one plugin from it is registered)
   * @param {string} ns - Namespace to check
   */
  isNamespaceInstalled(ns) {
    const plugins = this[DEFINITIONS].get(ns);
    if (!plugins) return false;

    for (const plugin of plugins) {
      if (this.has(plugin.id)) return true;
    }
    return false;
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
export default registry;
