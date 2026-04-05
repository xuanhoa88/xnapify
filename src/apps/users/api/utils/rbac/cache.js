/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// RBAC CACHE UTILITY
// ========================================================================

/**
 * RBAC Cache Module
 *
 * Provides caching for user RBAC data (roles, permissions, groups).
 * Uses lazy initialization with app.get('container').resolve('cache') factory or custom factory.
 */

// Singleton cache instance
let instance = null;

// Custom cache factory (if configured)
let customFactory = null;
let customConfig = null;

// Default cache options
const DEFAULT_OPTIONS = Object.freeze({
  type: 'memory',
  maxSize: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
});

// ========================================================================
// CONFIGURATION
// ========================================================================

/**
 * Configure cache with custom factory
 *
 * @param {Function} factory - Cache factory function
 * @param {Object} [options] - Cache options (type, maxSize, ttl, directory)
 * @returns {Object} Created cache instance
 */
export function configure(factory, options = {}) {
  if (!factory || typeof factory !== 'function') {
    const error = new Error('Invalid cache factory provided.');
    error.name = 'InvalidCacheFactoryError';
    error.code = 'INVALID_CACHE_FACTORY';
    error.status = 500;
    throw error;
  }

  customFactory = factory;
  customConfig = { ...DEFAULT_OPTIONS, ...options };

  // Create cache immediately
  const baseCache = customFactory(customConfig);
  instance =
    typeof customFactory.withNamespace === 'function'
      ? customFactory.withNamespace('rbac', baseCache)
      : baseCache;

  return instance;
}

/**
 * Reset cache (for testing)
 */
export function reset() {
  instance = null;
  customFactory = null;
  customConfig = null;
}

// ========================================================================
// INTERNAL HELPER
// ========================================================================

/**
 * Get cache instance (returns null if not available)
 */
function getInstance(appCache) {
  // If instance is already created, return it
  if (instance) return instance;

  // If custom factory is configured, use it (for testing/isolation)
  if (typeof customFactory === 'function') {
    const config = customConfig || DEFAULT_OPTIONS;
    const baseCache = customFactory(config);
    instance =
      typeof customFactory.withNamespace === 'function'
        ? customFactory.withNamespace('rbac', baseCache)
        : baseCache;
    return instance;
  }

  // Otherwise, get cache from app
  if (!appCache) return null;

  // appCache is expected to be a singleton instance (from shared/api/cache)
  // Check if it supports namespacing
  if (typeof appCache.withNamespace === 'function') {
    // Pass appCache as second arg to support both:
    // 1. Instance method: withNamespace(ns) - ignores 2nd arg
    // 2. Static method (if overwritten): withNamespace(ns, base) - usage 2nd arg
    instance = appCache.withNamespace('rbac');
    return instance;
  }

  // Fallback: use instance directly
  instance = appCache;
  return instance;
}

// ========================================================================
// PUBLIC API - User Cache Operations
// ========================================================================

/**
 * Get cached user data
 * @param {string} userId - User ID
 * @param {Object} [appCache] - Cache instance
 * @returns {Promise<Object|null>} Cached user data
 */
export async function getUser(userId, appCache) {
  if (!userId) return null;
  const c = getInstance(appCache);
  if (!c || typeof c.get !== 'function') return null;
  return await c.get(userId);
}

/**
 * Set cached user data
 * @param {string} userId - User ID
 * @param {Object} data - User data
 * @param {Object} [appCache] - Cache instance
 * @param {number} [ttl] - Optional TTL in milliseconds
 * @returns {Promise<void>}
 */
export async function setUser(userId, data, appCache, ttl) {
  if (!userId || !data) return;
  const c = getInstance(appCache);
  if (!c || typeof c.set !== 'function') return;
  return ttl ? await c.set(userId, data, ttl) : await c.set(userId, data);
}

/**
 * Invalidate cache for a user
 * @param {string} userId - User ID
 * @param {Object} [appCache] - Cache instance
 * @returns {Promise<void>}
 */
export async function invalidateUser(userId, appCache = null) {
  if (!userId) return;
  const c = getInstance(appCache);
  if (c && typeof c.delete === 'function') await c.delete(userId);
}

/**
 * Invalidate cache for multiple users
 * @param {string[]} userIds - Array of user IDs
 * @param {Object} [appCache] - Cache instance
 * @returns {Promise<void>}
 */
export async function invalidateUsers(userIds, appCache = null) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  const c = getInstance(appCache);
  if (c && typeof c.delete === 'function') {
    await Promise.all(userIds.map(id => c.delete(id)));
  }
}

/**
 * Invalidate all cached data
 * @param {Object} [appCache] - Cache instance
 * @returns {Promise<void>}
 */
export async function invalidateAll(appCache = null) {
  const c = getInstance(appCache);
  if (c && typeof c.clear === 'function') await c.clear();
}

// ========================================================================
// PUBLIC API - Cache Management
// ========================================================================

/**
 * Get cache statistics
 * @param {Object} [appCache] - Cache instance
 * @returns {Promise<Object|null>} Cache statistics
 */
export async function stats(appCache) {
  const c = getInstance(appCache);
  return c && typeof c.stats === 'function' ? await c.stats() : null;
}

/**
 * Cleanup expired entries
 * @param {Object} [appCache] - Cache instance
 * @returns {Promise<number>} Number of deleted entries
 */
export async function cleanup(appCache) {
  const c = getInstance(appCache);
  return c && typeof c.cleanup === 'function' ? await c.cleanup() : 0;
}
