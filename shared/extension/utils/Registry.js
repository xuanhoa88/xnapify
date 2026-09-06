/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { composeMiddleware } from '@shared/utils/middleware.js';

import Handler from './Handler.js';
import Hook from './Hook.js';

// Symbols — private (internal to registry)
const EXTENSIONS = Symbol('__xnapify.ext.list__');
const SLOTS = Symbol('__xnapify.ext.slots__');
const DEFINITIONS = Symbol('__xnapify.ext.definitions__');
const LISTENERS = Symbol('__xnapify.ext.listeners__');
const HOOKS = Symbol('__xnapify.ext.hooks__');
const HANDLERS = Symbol('__xnapify.ext.handlers__');
const REGISTRATIONS = Symbol('__xnapify.ext.registrations__');

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
    this[HOOKS] = new Hook(); // Collectors (many contributors)
    this[HANDLERS] = new Handler(); // Single-answer handlers (IPC)
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
      this[REGISTRATIONS].set(extensionId, { slots: [] });
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
    // No early return on a missing tracking entry. Only slots are tracked
    // there, so an extension that registered nothing but hooks or handlers
    // used to skip cleanup entirely and leak them past deactivation.
    const reg = this[REGISTRATIONS].get(extensionId);

    // Clear slots
    for (const { slotId, component } of (reg && reg.slots) || []) {
      this.unregisterSlot(slotId, component);
    }

    // Clear hooks (includes schema extenders) and single-answer handlers.
    // Counted before clearing, because the registries are the only place these
    // registrations were ever recorded.
    const hookCount = (this[HOOKS].registrations.get(extensionId) || new Set())
      .size;

    const handlerCount = this[HANDLERS].idsFor(extensionId).length;
    this[HOOKS].clear(extensionId);
    this[HANDLERS].clear(extensionId);

    if (__DEV__) {
      const total = ((reg && reg.slots.length) || 0) + hookCount + handlerCount;
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
    const extensionId = manifest.id || manifest.name;
    const meta = { description: manifest.description };

    if (!extensionId) {
      console.warn(
        '[ExtensionRegistry] Extension definition missing id or name',
      );
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
   * Remove an extension definition by ID across all namespaces.
   *
   * `unregister` clears what an extension *did* — its slots and hooks — while
   * leaving the definition in place, and that is deliberate:
   * `deactivateViewNamespace` unregisters extensions it fully intends to
   * activate again on the next navigation.
   *
   * An unloaded extension is the other case and must stay gone, so
   * `unloadExtension` calls this as well. A module-type extension is filed
   * under the `'*'` wildcard, which `getDefinitions` merges into *every*
   * namespace, so a definition left behind means the next
   * `ensureViewNamespaceActive` call re-runs its `menus()` and `boot()` —
   * a deactivated extension's sidebar entry reappearing on the very next
   * navigation is what this prevents.
   *
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
    // Drop the ownership record so ownsSlot() stays accurate
    for (const reg of this[REGISTRATIONS].values()) {
      reg.slots = reg.slots.filter(
        entry => !(entry.slotId === slotId && entry.component === component),
      );
    }
    return this;
  }

  /**
   * Whether `extensionId` registered `component` in `slotId`.
   * @param {string} extensionId
   * @param {string} slotId
   * @param {*} component
   * @returns {boolean}
   */
  ownsSlot(extensionId, slotId, component) {
    const reg = this[REGISTRATIONS].get(extensionId);
    if (!reg) return false;
    return reg.slots.some(
      entry => entry.slotId === slotId && entry.component === component,
    );
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
  registerHook(hookId, callback, extensionId, options = {}) {
    if (options && options.public !== undefined) {
      throw new TypeError(
        `Hook "${hookId}" was registered with { public }, which only applies to ` +
          'request/response handlers. Collectors are never reachable by an ' +
          'unauthenticated caller. Use registerHandler() if this is an IPC action.',
      );
    }
    this[HOOKS].register(hookId, callback, extensionId, options);
    return this;
  }

  unregisterHook(hookId, callback) {
    this[HOOKS].unregister(hookId, callback);
    return this;
  }

  /**
   * Whether `extensionId` registered `callback` for `hookId`.
   * @param {string} extensionId
   * @param {string} hookId
   * @param {Function} callback
   * @returns {boolean}
   */
  ownsHook(extensionId, hookId, callback) {
    return this[HOOKS].owns(extensionId, hookId, callback);
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
  // Handler Management (request/response extension points)
  // =========================================================================

  /**
   * Claim a handler id. One extension owns an id; a competing registration
   * throws instead of being resolved silently by priority.
   *
   * @param {string} handlerId - Handler identifier
   * @param {Function} callback - Handler function (may be async)
   * @param {string} [extensionId] - Owning extension, for auto-cleanup
   * @param {Object} [options]
   * @param {boolean} [options.public=false] - Allow unauthenticated callers
   * @throws {DuplicateHandlerError} When another callback already owns the id
   */
  registerHandler(handlerId, callback, extensionId, options = {}) {
    this[HANDLERS].register(handlerId, callback, extensionId, options);
    return this;
  }

  /**
   * Release a handler id. No callback argument is needed because an id has a
   * single owner.
   * @param {string} handlerId - Handler identifier
   * @returns {ExtensionRegistry} this
   */
  unregisterHandler(handlerId) {
    this[HANDLERS].unregister(handlerId);
    return this;
  }

  /**
   * @param {string} handlerId
   * @returns {boolean}
   */
  hasHandler(handlerId) {
    return this[HANDLERS].has(handlerId);
  }

  /**
   * Registration metadata, e.g. `{ public: true }`.
   * @param {string} handlerId
   * @returns {Object}
   */
  getHandlerMeta(handlerId) {
    return this[HANDLERS].getMeta(handlerId);
  }

  /**
   * Whether `extensionId` owns this handler id.
   * @param {string} extensionId
   * @param {string} handlerId
   * @returns {boolean}
   */
  ownsHandler(extensionId, handlerId) {
    return this[HANDLERS].owns(extensionId, handlerId);
  }

  /**
   * Call the handler and return `{ handled, value, extensionId }`.
   * Handler errors propagate so the caller can report a real failure.
   *
   * @param {string} handlerId - Handler identifier
   * @param {...any} args - Arguments passed to the handler
   * @returns {Promise<{handled: boolean, value: any, extensionId: string|undefined}>}
   */
  async invokeHandler(handlerId, ...args) {
    return this[HANDLERS].invoke(handlerId, ...args);
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
    this[HANDLERS].clear();
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
