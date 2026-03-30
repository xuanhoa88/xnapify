/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * NoOp Cache Adapter
 *
 * A no-operation cache adapter that disables caching entirely.
 * Used in development mode to ensure fresh data on every request.
 *
 * All operations are pass-through with no actual caching:
 * - get() always returns null
 * - set() is a no-op
 * - delete() always returns true
 * - has() always returns false
 * - clear() is a no-op
 * - stats() returns empty stats
 * - cleanup() is a no-op
 * - keys() returns empty array
 */
export default class NoOpCache {
  /**
   * Create a new NoOp cache instance
   * @param {Object} [_options] - Unused, provided for interface compatibility
   */
  constructor(_options = {}) {
    // No-op
  }

  /**
   * Get a value from cache
   * Always returns null since nothing is cached
   *
   * @param {string} _key - Cache key (ignored)
   * @returns {null} Always null
   */
  get(_key) {
    return null;
  }

  /**
   * Set a value in cache
   * No-op, nothing is cached
   *
   * @param {string} _key - Cache key (ignored)
   * @param {*} _value - Value to cache (ignored)
   * @param {number} [_ttl] - TTL in ms (ignored)
   * @returns {undefined}
   */
  set(_key, _value, _ttl) {
    // No-op
  }

  /**
   * Delete a value from cache
   * Returns true immediately since there's nothing to delete
   *
   * @param {string} _key - Cache key (ignored)
   * @returns {true}
   */
  delete(_key) {
    return true;
  }

  /**
   * Check if a key exists in cache
   * Always returns false since nothing is cached
   *
   * @param {string} _key - Cache key (ignored)
   * @returns {false}
   */
  has(_key) {
    return false;
  }

  /**
   * Clear all entries from cache
   * No-op, there are no entries to clear
   *
   * @returns {undefined}
   */
  clear() {
    // No-op
  }

  /**
   * Get all cache keys
   * Returns empty array since nothing is cached
   *
   * @returns {Array<string>} Empty array
   */
  keys() {
    return [];
  }

  /**
   * Get cache statistics
   * Returns empty stats object
   *
   * @returns {Object} Empty stats
   */
  stats() {
    return {
      entries: 0,
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Cleanup expired entries
   * No-op, there are no entries to clean up
   *
   * @returns {Promise<void>}
   */
  cleanup() {
    return Promise.resolve();
  }

  /**
   * Get the number of entries in cache
   * Always 0 since nothing is cached
   *
   * @returns {number} 0
   */
  get size() {
    return 0;
  }
}
