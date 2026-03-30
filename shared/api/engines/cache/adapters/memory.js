/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Memory Cache Adapter
 *
 * LRU (Least Recently Used) cache implementation with:
 * - Max size limit to prevent memory leaks
 * - TTL-based expiration
 * - Automatic LRU eviction when limit reached
 *
 * Common Cache Interface:
 * - get(key): Get value from cache
 * - set(key, value, ttl): Store value in cache
 * - delete(key): Remove value from cache
 * - has(key): Check if key exists
 * - clear(): Remove all entries
 * - stats(): Get cache statistics
 * - cleanup(): Remove expired entries
 * - keys(): Get all cache keys
 * - size: Get number of entries
 */
export default class MemoryCache {
  /**
   * Create a new memory cache instance
   *
   * @param {Object} options
   * @param {number} [options.maxSize=1000] - Maximum entries
   * @param {number} [options.ttl=300000] - Default TTL in ms (5 min)
   */
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.ttl || 5 * 60 * 1000; // 5 minutes
    this.cache = new Map(); // Map preserves insertion order for LRU
  }

  /**
   * Get a value from cache
   *
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end for LRU (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set a value in cache
   *
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - TTL in ms (optional, uses default)
   */
  set(key, value, ttl = this.defaultTTL) {
    // Remove existing entry if present (for LRU ordering)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entries if at max size
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    });
  }

  /**
   * Delete a value from cache
   *
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Check if key exists and is not expired
   *
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache stats
   */
  stats() {
    let validCount = 0;
    let expiredCount = 0;
    const now = Date.now();

    this.cache.forEach(entry => {
      if (now > entry.expiresAt) {
        expiredCount++;
      } else {
        validCount++;
      }
    });

    return {
      type: 'memory',
      totalEntries: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount,
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
    };
  }

  /**
   * Clean up expired entries
   *
   * @returns {number} Number of entries removed
   */
  cleanup() {
    console.info('🧹 Cleaning up expired memory cache entries...');
    const now = Date.now();
    let removed = 0;

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    });

    return removed;
  }

  /**
   * Get all keys (for debugging)
   *
   * @returns {string[]} Array of keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   *
   * @returns {number} Current number of entries
   */
  get size() {
    return this.cache.size;
  }
}
