/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const PREFIX = 'XNAPIFY_';
const coreConfig = {};

// Load once at startup, stripping the prefix
Object.keys(process.env).forEach(key => {
  if (key.startsWith(PREFIX)) {
    const cleanKey = key.slice(PREFIX.length);
    coreConfig[cleanKey] = process.env[key];
  }
});

// Wrap process.env in a Proxy to prevent mutation of XNAPIFY_ keys
// This protects our specific variables without breaking the Node ecosystem
process.env = new Proxy(process.env, {
  set(target, prop, value) {
    if (typeof prop === 'string' && prop.startsWith(PREFIX)) {
      const err = new Error(
        `Cannot mutate protected environment variable: ${prop}`,
      );
      err.name = 'ConfigError';
      err.code = 'ERR_PROTECTED_ENV_MUTATION';
      throw err;
    }
    target[prop] = String(value);
    return true;
  },
  deleteProperty(target, prop) {
    if (typeof prop === 'string' && prop.startsWith(PREFIX)) {
      const err = new Error(
        `Cannot delete protected environment variable: ${prop}`,
      );
      err.name = 'ConfigError';
      err.code = 'ERR_PROTECTED_ENV_MUTATION';
      throw err;
    }
    delete target[prop];
    return true;
  },
});

// Freeze core config object to make it immutable
Object.freeze(coreConfig);

/**
 * Returns the core config singleton.
 * @param {Object} [adapter] - Optional persistence adapter instance
 */
export function createFactory(adapter = null) {
  return {
    /** Get a value from the core config */
    get: async key => coreConfig[key],
    /** Return a shallow copy of all core entries */
    all: async () => Object.freeze({ ...coreConfig }),
    /** Alias – obtain a namespaced wrapper */
    withNamespace: namespace => withNamespace(namespace, adapter),
  };
}

/**
 * Returns a wrapper that operates within a specific namespace.
 * The wrapper provides `get`, `set`, `use` (alias of `get`), `delete` and `all`.
 */
export function withNamespace(namespace, adapter = null) {
  const scoped = {};
  return {
    /** Set a namespaced key */
    set: async (key, value) => {
      scoped[`${namespace}_${key}`] = value;
      if (adapter) {
        await adapter.set(namespace, key, value);
      }
    },
    /** Retrieve a namespaced key, falling back to core if not set */
    get: async key => {
      if (adapter) {
        const persisted = await adapter.get(namespace, key);
        if (persisted !== undefined) return persisted;
      }
      return scoped[`${namespace}_${key}`] || coreConfig[`${namespace}_${key}`];
    },
    /** Alias for `get` – more expressive */
    use: async function (key) {
      return await this.get(key);
    },
    /** Delete a namespaced key, or clear the entire namespace if key is omitted */
    delete: async key => {
      if (key == null) {
        Object.keys(scoped).forEach(k => delete scoped[k]);
        if (adapter) {
          await adapter.delete(namespace);
        }
      } else {
        delete scoped[`${namespace}_${key}`];
        if (adapter) {
          await adapter.delete(namespace, key);
        }
      }
    },
    /** Merge core and scoped values */
    all: async () => Object.freeze({ ...coreConfig, ...scoped }),
  };
}
