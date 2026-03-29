/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { composeMiddleware } from '@shared/utils/middleware';

import Hook from './Hook';

// Symbols — private (internal to registry)
const EXTENSIONS = Symbol('__rsk.ext.list__');
const SLOTS = Symbol('__rsk.ext.slots__');
const DEFINITIONS = Symbol('__rsk.ext.definitions__');
const LISTENERS = Symbol('__rsk.ext.listeners__');
const HOOKS = Symbol('__rsk.ext.hooks__');
const REGISTRATIONS = Symbol('__rsk.ext.registrations__');

/**
 * ExtensionRegistry - Manages extension registrations, UI slots, hooks, and schema extensions
 *
 * All registration methods are idempotent - safe to call multiple times.
 * Extension boot/shutdown and hooks support async/await.
 */
class ExtensionRegistry {
  constructor() {
    this[EXTENSIONS] = new Map(); // Map<id, extension>
    this[SLOTS] = new Map(); // Map<slotId, Map<component, options>>
    this[HOOKS] = new Hook(); // Specialized hook manager
    this[DEFINITIONS] = new Map(); // Map<namespace, Array<definition>>
    this[LISTENERS] = new Set(); // Set<callback>
    this[REGISTRATIONS] = new Map(); // Map<extensionId, { slots: [], hooks: [] }>
  }

  // =========================================================================
  // Extension Management
  // =========================================================================

  /**
   * Register an extension (idempotent, supports async boot)
   * @param {string} extensionId - Extension identifier
   * @param {Object} ext - { name, boot, shutdown }
   * @param {Object} context - Optional extension context (i18n, store, etc.)
   * @returns {Promise<this>}
   */
  register(extensionId, ext) {
    if (this[EXTENSIONS].has(extensionId)) return this;

    this[EXTENSIONS].set(extensionId, { ...ext, id: extensionId });

    return this;
  }

  /**
   * Unregister an extension by ID (supports async shutdown)
   * Automatically cleans up all registrations made by this extension
   * @param {string} extensionId - Extension identifier
   * @param {Object} context - Optional extension context
   * @returns {Promise<this>}
   */
  unregister(extensionId) {
    // Clean up all registrations (slots, hooks)
    // eslint-disable-next-line no-underscore-dangle
    this._clearExtensionRegistrations(extensionId);
    this[EXTENSIONS].delete(extensionId);
    return this;
  }

  /** Check if an extension is registered */
  has(extensionId) {
    return this[EXTENSIONS].has(extensionId);
  }

  /** Get an extension by ID */
  get(extensionId) {
    return this[EXTENSIONS].get(extensionId);
  }

  /** Get list of registered extension IDs */
  list() {
    return Array.from(this[EXTENSIONS].keys());
  }

  /**
   * Track a registration for an extension (internal helper)
   * @param {string} extensionId - Extension that owns this registration
   * @param {string} type - 'slots' | 'hooks' | 'schemas'
   * @param {Object} data - Registration data to track
   */
  _trackRegistration(extensionId, type, data) {
    if (!extensionId) return;

    if (!this[REGISTRATIONS].has(extensionId)) {
      this[REGISTRATIONS].set(extensionId, { slots: [], hooks: [] });
    }
    const reg = this[REGISTRATIONS].get(extensionId);
    if (reg[type]) {
      reg[type].push(data);
    }
  }

  /**
   * Clear all registrations made by an extension
   * @param {string} extensionId - Extension to clear registrations for
   */
  _clearExtensionRegistrations(extensionId) {
    const reg = this[REGISTRATIONS].get(extensionId);
    if (!reg) return;

    // Clear slots
    for (const { slotId, component } of reg.slots) {
      this.unregisterSlot(slotId, component);
    }

    // Clear hooks (includes schema extenders)
    this[HOOKS].clear(extensionId);

    if (__DEV__) {
      const total = reg.slots.length + reg.hooks.length;
      if (total > 0) {
        console.log(
          `[ExtensionRegistry] Cleared ${total} registrations for extension: ${extensionId}`,
        );
      }
    }

    // Remove tracking entry
    this[REGISTRATIONS].delete(extensionId);
  }

  // =========================================================================
  // Definition & Namespace Management
  // =========================================================================

  /**
   * Register an extension definition using manifest metadata
   * Namespaces and identity come from the manifest's slots, name, and description fields.
   * @param {Object} definition - Extension definition object (boot, shutdown, translations)
   * @param {Object} context - Extension context
   * @param {Object} manifest - Extension manifest from package.json
   */
  defineExtension(definition, context, manifest) {
    if (!manifest) {
      console.warn(
        '[ExtensionRegistry] Invalid extension definition: missing manifest',
      );
      return this;
    }

    const namespaces = Array.isArray(manifest.slots) ? manifest.slots : [];
    const extensionId = manifest.name;
    const meta = { description: manifest.description };

    if (!extensionId) {
      console.warn('[ExtensionRegistry] Extension definition missing name');
      return this;
    }

    // Extensions with routes() are module-type (eagerly activated)
    const hasRoutes = typeof definition.routes === 'function';

    // Module-type extensions auto-subscribe to '*' (wildcard) if no explicit
    // subscribe is declared. This ensures their route init hooks (e.g.
    // registerMenu) run on every route navigation, keeping menus consistent
    // between SSR and client hydration.
    const effectiveNamespaces =
      namespaces.length === 0 && hasRoutes ? ['*'] : namespaces;

    if (effectiveNamespaces.length === 0 && !hasRoutes) {
      console.warn(
        `[ExtensionRegistry] Extension "${extensionId}" has no subscribed namespaces`,
      );
    }

    for (const ns of effectiveNamespaces) {
      if (!this[DEFINITIONS].has(ns)) {
        this[DEFINITIONS].set(ns, new Set());
      }

      // Store the full definition wrapper
      const definitions = this[DEFINITIONS].get(ns);
      const newDef = {
        ...definition,
        ...meta,
        context,
        id: extensionId,
      };

      // Remove existing definition with same ID if present (update/overwrite)
      for (const def of definitions) {
        if (def.id === extensionId) {
          definitions.delete(def);
          break;
        }
      }

      definitions.add(newDef);
    }

    return this;
  }

  /**
   * Find an extension definition by ID across all namespaces
   * @param {string} id - Extension ID
   * @returns {Object|null} Extension definition or null
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
   * Remove an extension definition by ID across all namespaces
   * @param {string} id - Extension ID
   * @returns {boolean} True if any definition was removed
   */
  removeDefinition(id) {
    let removed = false;
    for (const [, definitions] of this[DEFINITIONS]) {
      for (const def of definitions) {
        if (def.id === id) {
          definitions.delete(def);
          removed = true;
          // Don't break here, as extension might be defined in multiple namespaces
        }
      }
    }
    return removed;
  }

  /**
   * Get all extension definitions for a namespace
   * @param {string} ns - Namespace
   * @returns {Set|null} Set of extension definitions or null
   */
  getDefinitions(ns) {
    const exact = this[DEFINITIONS].get(ns);
    const wildcard = ns !== '*' ? this[DEFINITIONS].get('*') : null;

    if (!exact && !wildcard) return null;

    // Merge exact and wildcard definitions into a single Set
    const merged = new Set();
    if (exact) exact.forEach(d => merged.add(d));
    if (wildcard) wildcard.forEach(d => merged.add(d));
    return merged.size > 0 ? merged : null;
  }

  /**
   * Install a specific extension by ID
   * Calls the install() lifecycle hook if present
   * @param {string} id - Extension ID
   * @returns {Promise<boolean>} True if installed successfully
   */
  async runInstallHook(id) {
    const definition = this.findDefinition(id);
    if (!definition) {
      console.warn(
        `[ExtensionRegistry] Cannot install: extension "${id}" not found`,
      );
      return false;
    }

    // Call install hook if present
    if (typeof definition.install === 'function') {
      try {
        await definition.install(definition.context);
        if (__DEV__) {
          console.log(`[ExtensionRegistry] Installed extension: ${id}`);
        }
      } catch (error) {
        console.error(
          `[ExtensionRegistry] Failed to install extension "${id}":`,
          error,
        );
        throw error;
      }
    }

    return true;
  }

  /**
   * Uninstall a specific extension by ID
   * Calls the uninstall() lifecycle hook if present
   * @param {string} id - Extension ID
   * @returns {Promise<boolean>} True if uninstalled successfully
   */
  async runUninstallHook(id) {
    const definition = this.findDefinition(id);
    if (!definition) {
      console.warn(
        `[ExtensionRegistry] Cannot uninstall: extension "${id}" not found`,
      );
      return false;
    }

    // Call uninstall hook if present
    if (typeof definition.uninstall === 'function') {
      try {
        await definition.uninstall(definition.context);
        if (__DEV__) {
          console.log(`[ExtensionRegistry] Uninstalled extension: ${id}`);
        }
      } catch (error) {
        console.error(
          `[ExtensionRegistry] Failed to uninstall extension "${id}":`,
          error,
        );
        throw error;
      }
    }

    return true;
  }

  /**
   * Update a specific extension by ID
   * Unloads current instance and reloads for new version
   * @param {string} id - Extension ID
   * @returns {Promise<boolean>} True if updated successfully
   */
  async runUpdateHook(id) {
    if (__DEV__) {
      console.log(`[ExtensionRegistry] Updating extension: ${id}`);
    }

    // Find definition
    const definition = this.findDefinition(id);
    if (!definition) {
      console.warn(
        `[ExtensionRegistry] Cannot load: extension "${id}" not found`,
      );
      return false;
    }

    // Unload if currently loaded
    if (this.has(id)) {
      this.unregister(id);
    }

    // Reload extension
    return this.register(id, definition);
  }

  // =========================================================================
  // Slot Management (UI extension points)
  // =========================================================================

  /**
   * Register a component for a slot (idempotent)
   * @param {string} slotId - Slot identifier
   * @param {React.Component} component - Component to render
   * @param {Object} options - { order: number, extensionId: string, ... }
   */
  registerSlot(slotId, component, options = {}) {
    const { extensionId, ...slotOptions } = options;
    if (!this[SLOTS].has(slotId)) {
      this[SLOTS].set(slotId, new Map());
    }
    const slotMap = this[SLOTS].get(slotId);
    if (!slotMap.has(component)) {
      slotMap.set(component, { order: 0, ...slotOptions });
      // eslint-disable-next-line no-underscore-dangle
      this._trackRegistration(extensionId, 'slots', { slotId, component });
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
  getSlotEntries(slotId) {
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
   * @param {string} [extensionId] - Optional extension ID for auto-cleanup
   */
  registerHook(hookId, callback, extensionId) {
    this[HOOKS].register(hookId, callback, extensionId);
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
    this[EXTENSIONS].clear();
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

// Export class only — each environment creates its own singleton
// (see server/Registry.js and client/Registry.js)
export default ExtensionRegistry;
