/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Binding types used internally to distinguish resolution strategies.
 * @enum {string}
 */
const BINDING_TYPE = Object.freeze({
  /** Fresh instance on every resolve */
  FACTORY: 'factory',
  /** Resolved once, then cached */
  SINGLETON: 'singleton',
  /** Pre-built value, returned as-is */
  INSTANCE: 'instance',
});

// Private symbol for internal state (matches HookFactory convention)
const BINDINGS = Symbol('__rsk.containerBindings__');
const PARENT = Symbol('__rsk.containerParent__');

/**
 * A lightweight, isomorphic Dependency Injection container.
 *
 * Works identically on both client (browser) and server (Node.js)
 * since it uses only standard ES features — no platform-specific APIs.
 *
 * ## Binding Types
 *
 * | Method          | Resolution behaviour            |
 * |-----------------|---------------------------------|
 * | `bind()`        | Factory — new value every call  |
 * | `factory()`     | Alias for `bind()`              |
 * | `singleton()`   | Resolved once, then cached      |
 * | `instance()`    | Stores a pre-built value        |
 *
 * ## Persistent Bindings (Ownership Key)
 *
 * Any registration method accepts an optional `ownerKey` (any truthy value).
 * Only the holder of the same key can overwrite or remove the binding:
 *
 * ```js
 * const MY_KEY = Symbol('auth-module');
 * container.bind('core:auth', () => authService, MY_KEY);
 *
 * // Another module tries to overwrite — throws PersistentBindingError
 * container.bind('core:auth', () => evilService);
 *
 * // reset() also requires the key
 * container.reset('core:auth');          // throws
 * container.reset('core:auth', MY_KEY);  // works
 *
 * // cleanup() can target specific owners
 * container.cleanup();           // removes non-persistent only
 * container.cleanup(MY_KEY);     // removes non-persistent + MY_KEY bindings
 * ```
 *
 * ## Usage
 *
 * ```js
 * const container = new Container();
 *
 * // Register a factory (new object each time)
 * container.bind('logger', () => new Logger());
 *
 * // Register a singleton (created once)
 * container.singleton('db', () => createConnection());
 *
 * // Register a pre-built value
 * container.instance('config', { debug: true });
 *
 * // Resolve
 * const logger = container.resolve('logger');
 * const db     = container.resolve('db');
 * const cfg    = container.resolve('config');
 * ```
 */
class Container {
  constructor() {
    /**
     * Internal registry of bindings.
     * @type {Map<string, {type: string, persistent: *, factory?: Function, value?: *}>}
     */
    this[BINDINGS] = new Map();
    this[PARENT] = null;
  }

  /**
   * Create a child container that inherits bindings from this container.
   * The child resolves its own bindings first; if not found, it delegates
   * to the parent. Bindings added to the child do NOT affect the parent.
   *
   * @returns {Container} A new child container
   */
  createChild() {
    const child = new Container();
    child[PARENT] = this;
    return child;
  }

  // ===========================================================================
  // REGISTRATION
  // ===========================================================================

  /**
   * Register a factory binding.
   * The factory is invoked on **every** call to `resolve()`.
   *
   * @param {string} name - Binding key (e.g. `'users:services'`)
   * @param {Function} factory - Factory function that returns the value
   * @param {*} [ownerKey] - If truthy, marks this binding as persistent under this key
   * @returns {Container} This container (for chaining)
   * @throws {TypeError} If name is not a non-empty string or factory is not a function
   * @throws {Error} If a persistent binding already exists under this name with a different key
   */
  bind(name, factory, ownerKey) {
    validateName(name);
    validateFactory(factory);
    guardPersistent(this, name, ownerKey);

    this[BINDINGS].set(name, {
      type: BINDING_TYPE.FACTORY,
      factory,
      persistent: ownerKey || false,
    });

    return this;
  }

  /**
   * Alias for {@link Container#bind}.
   * Semantically explicit "always new" registration.
   *
   * @param {string} name - Binding key
   * @param {Function} factory - Factory function
   * @param {*} [ownerKey] - If truthy, marks this binding as persistent under this key
   * @returns {Container} This container (for chaining)
   */
  factory(name, factory, ownerKey) {
    return this.bind(name, factory, ownerKey);
  }

  /**
   * Register a singleton binding.
   * The factory is invoked **once** on the first `resolve()`; the result is
   * cached and returned on all subsequent calls.
   *
   * @param {string} name - Binding key
   * @param {Function} factory - Factory function that returns the value
   * @param {*} [ownerKey] - If truthy, marks this binding as persistent under this key
   * @returns {Container} This container (for chaining)
   * @throws {TypeError} If name is not a non-empty string or factory is not a function
   * @throws {Error} If a persistent binding already exists under this name with a different key
   */
  singleton(name, factory, ownerKey) {
    validateName(name);
    validateFactory(factory);
    guardPersistent(this, name, ownerKey);

    this[BINDINGS].set(name, {
      type: BINDING_TYPE.SINGLETON,
      factory,
      resolved: false,
      value: undefined,
      persistent: ownerKey || false,
    });

    return this;
  }

  /**
   * Register a pre-built value directly.
   * `resolve()` returns the exact value without invoking any factory.
   *
   * @param {string} name - Binding key
   * @param {*} value - The value to store
   * @param {*} [ownerKey] - If truthy, marks this binding as persistent under this key
   * @returns {Container} This container (for chaining)
   * @throws {TypeError} If name is not a non-empty string
   * @throws {Error} If a persistent binding already exists under this name with a different key
   */
  instance(name, value, ownerKey) {
    validateName(name);
    guardPersistent(this, name, ownerKey);

    this[BINDINGS].set(name, {
      type: BINDING_TYPE.INSTANCE,
      value,
      persistent: ownerKey || false,
    });

    return this;
  }

  // ===========================================================================
  // RESOLUTION
  // ===========================================================================

  /**
   * Resolve a binding by name.
   *
   * @param {string} name - Binding key
   * @returns {*} Resolved value
   * @throws {Error} If no binding is registered under the given name
   */
  resolve(name) {
    const binding = this[BINDINGS].get(name);

    if (!binding) {
      // Delegate to parent container if available
      if (this[PARENT]) {
        return this[PARENT].resolve(name);
      }

      const error = new Error(
        `No binding registered for "${name}". Available: [${this.getBindingNames().join(', ')}]`,
      );
      error.name = 'BindingNotFoundError';
      error.code = 'E_BINDING_NOT_FOUND';
      throw error;
    }

    switch (binding.type) {
      case BINDING_TYPE.INSTANCE:
        return binding.value;

      case BINDING_TYPE.SINGLETON:
        if (!binding.resolved) {
          binding.value = binding.factory(this);
          binding.resolved = true;
        }
        return binding.value;

      case BINDING_TYPE.FACTORY:
        return binding.factory(this);

      default: {
        const error = new Error(`Unknown binding type: "${binding.type}"`);
        error.name = 'ContainerError';
        error.code = 'E_UNKNOWN_BINDING_TYPE';
        throw error;
      }
    }
  }

  /**
   * Alias for {@link Container#resolve}.
   *
   * @param {string} name - Binding key
   * @returns {*} Resolved value
   */
  make(name) {
    return this.resolve(name);
  }

  // ===========================================================================
  // INSPECTION
  // ===========================================================================

  /**
   * Check if a binding exists.
   *
   * @param {string} name - Binding key
   * @returns {boolean} `true` if the binding is registered
   */
  has(name) {
    return (
      this[BINDINGS].has(name) ||
      (this[PARENT] ? this[PARENT].has(name) : false)
    );
  }

  /**
   * Get all registered binding names (including parent bindings).
   *
   * @returns {string[]} Array of binding keys
   */
  getBindingNames() {
    const names = new Set(this[BINDINGS].keys());
    if (this[PARENT]) {
      for (const name of this[PARENT].getBindingNames()) {
        names.add(name);
      }
    }
    return Array.from(names);
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Remove a single binding.
   *
   * @param {string} name - Binding key to remove
   * @param {*} [ownerKey] - Required if the binding is persistent
   * @returns {boolean} `true` if the binding existed and was removed
   * @throws {Error} If the binding is persistent and key does not match
   */
  reset(name, ownerKey) {
    guardPersistent(this, name, ownerKey);
    return this[BINDINGS].delete(name);
  }

  /**
   * Remove bindings in bulk.
   *
   * - Called with no arguments: removes all **non-persistent** bindings.
   * - Called with owner keys: removes non-persistent **+** bindings owned by any of the given keys.
   *
   * @param {...*} ownerKeys - Zero or more owner keys whose bindings should also be removed
   */
  cleanup(...ownerKeys) {
    for (const [name, binding] of this[BINDINGS]) {
      if (!binding.persistent || ownerKeys.includes(binding.persistent)) {
        this[BINDINGS].delete(name);
      }
    }
  }
}

// =============================================================================
// MODULE-PRIVATE HELPERS
// =============================================================================

/**
 * Validate that a binding name is a non-empty string.
 *
 * @param {string} name - Value to validate
 * @throws {TypeError} If validation fails
 */
function validateName(name) {
  if (typeof name !== 'string' || name.length === 0) {
    const error = new TypeError(
      `Binding name must be a non-empty string, got ${typeof name}`,
    );
    error.code = 'E_INVALID_NAME';
    throw error;
  }
}

/**
 * Validate that a factory is a function.
 *
 * @param {Function} factory - Value to validate
 * @throws {TypeError} If validation fails
 */
function validateFactory(factory) {
  if (typeof factory !== 'function') {
    const error = new TypeError(
      `Factory must be a function, got ${typeof factory}`,
    );
    error.code = 'E_INVALID_FACTORY';
    throw error;
  }
}

/**
 * Guard against overwriting or removing a persistent binding.
 *
 * @param {Container} container - Container instance to check
 * @param {string} name - Binding key to check
 * @param {*} [providedKey] - The owner key being presented
 * @throws {Error} If the binding exists, is persistent, and the key does not match
 */
function guardPersistent(container, name, providedKey) {
  const existing = container[BINDINGS].get(name);
  if (existing && existing.persistent && existing.persistent !== providedKey) {
    const error = new Error(
      `Cannot overwrite or remove persistent binding "${name}"`,
    );
    error.name = 'PersistentBindingError';
    error.code = 'E_PERSISTENT_BINDING';
    throw error;
  }
}

export default Container;
