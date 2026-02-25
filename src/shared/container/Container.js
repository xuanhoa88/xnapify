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
 * ## Persistent Bindings
 *
 * Any registration method accepts a `persistent` flag.
 * Persistent bindings cannot be overwritten or removed by other modules:
 *
 * ```js
 * container.bind('core:auth', () => authService, true);
 *
 * // Later, another module tries to overwrite — throws PersistentBindingError
 * container.bind('core:auth', () => evilService);
 *
 * // reset() also throws
 * container.reset('core:auth'); // throws
 *
 * // cleanup() skips persistent bindings
 * container.cleanup();           // 'core:auth' survives
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
     * @type {Map<string, {type: string, persistent: boolean, factory?: Function, value?: *}>}
     */
    this[BINDINGS] = new Map();
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
   * @param {boolean} [persistent=false] - If `true`, binding cannot be overwritten or removed
   * @returns {Container} This container (for chaining)
   * @throws {TypeError} If name is not a non-empty string or factory is not a function
   * @throws {Error} If a persistent binding already exists under this name
   */
  bind(name, factory, persistent) {
    validateName(name);
    validateFactory(factory);
    guardPersistent(this, name);

    this[BINDINGS].set(name, {
      type: BINDING_TYPE.FACTORY,
      factory,
      persistent: Boolean(persistent),
    });

    return this;
  }

  /**
   * Alias for {@link Container#bind}.
   * Semantically explicit "always new" registration.
   *
   * @param {string} name - Binding key
   * @param {Function} factory - Factory function
   * @param {boolean} [persistent=false] - If `true`, binding cannot be overwritten or removed
   * @returns {Container} This container (for chaining)
   */
  factory(name, factory, persistent) {
    return this.bind(name, factory, persistent);
  }

  /**
   * Register a singleton binding.
   * The factory is invoked **once** on the first `resolve()`; the result is
   * cached and returned on all subsequent calls.
   *
   * @param {string} name - Binding key
   * @param {Function} factory - Factory function that returns the value
   * @param {boolean} [persistent=false] - If `true`, binding cannot be overwritten or removed
   * @returns {Container} This container (for chaining)
   * @throws {TypeError} If name is not a non-empty string or factory is not a function
   * @throws {Error} If a persistent binding already exists under this name
   */
  singleton(name, factory, persistent) {
    validateName(name);
    validateFactory(factory);
    guardPersistent(this, name);

    this[BINDINGS].set(name, {
      type: BINDING_TYPE.SINGLETON,
      factory,
      resolved: false,
      value: undefined,
      persistent: Boolean(persistent),
    });

    return this;
  }

  /**
   * Register a pre-built value directly.
   * `resolve()` returns the exact value without invoking any factory.
   *
   * @param {string} name - Binding key
   * @param {*} value - The value to store
   * @param {boolean} [persistent=false] - If `true`, binding cannot be overwritten or removed
   * @returns {Container} This container (for chaining)
   * @throws {TypeError} If name is not a non-empty string
   * @throws {Error} If a persistent binding already exists under this name
   */
  instance(name, value, persistent) {
    validateName(name);
    guardPersistent(this, name);

    this[BINDINGS].set(name, {
      type: BINDING_TYPE.INSTANCE,
      value,
      persistent: Boolean(persistent),
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
    return this[BINDINGS].has(name);
  }

  /**
   * Get all registered binding names.
   *
   * @returns {string[]} Array of binding keys
   */
  getBindingNames() {
    return Array.from(this[BINDINGS].keys());
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Remove a single binding.
   *
   * @param {string} name - Binding key to remove
   * @returns {boolean} `true` if the binding existed and was removed
   * @throws {Error} If the binding is persistent
   */
  reset(name) {
    guardPersistent(this, name);
    return this[BINDINGS].delete(name);
  }

  /**
   * Remove all bindings.
   * Persistent bindings are always preserved.
   */
  cleanup() {
    for (const [name, binding] of this[BINDINGS]) {
      if (!binding.persistent) {
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
 * @throws {Error} If the binding exists and is persistent
 */
function guardPersistent(container, name) {
  const existing = container[BINDINGS].get(name);
  if (existing && existing.persistent) {
    const error = new Error(
      `Cannot overwrite or remove persistent binding "${name}"`,
    );
    error.name = 'PersistentBindingError';
    error.code = 'E_PERSISTENT_BINDING';
    throw error;
  }
}

export default Container;
