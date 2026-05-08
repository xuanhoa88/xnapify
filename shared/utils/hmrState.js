/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// A single global Symbol for the entire HMR state store
const HMR_STORE_KEY = Symbol.for('__xnapify.hmr.serverStore__');

/**
 * Lazily initialise the global store and return it.
 * @returns {Map}
 */
function ensureStore() {
  if (!globalThis[HMR_STORE_KEY]) {
    globalThis[HMR_STORE_KEY] = new Map();
  }
  return globalThis[HMR_STORE_KEY];
}

/**
 * Centralized HMR state manager for server-side modules.
 * Ensures state survives Tier 3 (require.cache clear) full reloads
 * by safely caching it on globalThis behind a single Symbol.
 *
 * @param {string} key - Unique identifier for this state (e.g., 'db:connections')
 * @param {Function} [initializer] - Function that returns the initial state if it doesn't exist.
 *   Optional when retrieving a key that is guaranteed to exist already.
 * @returns {any} The preserved state (or undefined if key is missing and no initializer given)
 */
export function getHmrState(key, initializer) {
  // In production, just run the initializer (no global caching needed)
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return typeof initializer === 'function' ? initializer() : undefined;
  }

  const store = ensureStore();

  // Return cached state or initialize it
  if (!store.has(key) && typeof initializer === 'function') {
    store.set(key, initializer());
  }

  return store.get(key);
}

/**
 * Update or set a specific HMR state directly.
 * @param {string} key - The state key to set
 * @param {any} value - The value to store
 */
export function setHmrState(key, value) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    ensureStore().set(key, value);
  }
}

/**
 * Clear a specific HMR state.
 * @param {string} key - The state key to clear
 */
export function clearHmrState(key) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const store = globalThis[HMR_STORE_KEY];
    if (store) store.delete(key);
  }
}
