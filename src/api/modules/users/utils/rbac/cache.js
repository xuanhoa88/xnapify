/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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
 * Uses lazy initialization with app.get('cache') factory or custom factory.
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
    throw new Error('Invalid cache factory provided.');
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
function getInstance(app) {
  if (instance) return instance;

  // If custom factory is configured, use it
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
  const appCache = app && app.get('cache');
  if (!appCache) return null;

  // If appCache is a function (factory), call it
  if (typeof appCache === 'function') {
    const config = customConfig || DEFAULT_OPTIONS;
    const baseCache = appCache(config);
    instance =
      typeof appCache.withNamespace === 'function'
        ? appCache.withNamespace('rbac', baseCache)
        : baseCache;
    return instance;
  }

  // If appCache is already an instance, use it directly
  instance = appCache;
  return instance;
}

// ========================================================================
// PUBLIC API - User Cache Operations
// ========================================================================

/**
 * Get cached user data
 */
export function getUser(userId, app) {
  if (!userId) return null;
  const c = getInstance(app);
  if (!c || typeof c.get !== 'function') return null;
  return c.get(userId);
}

/**
 * Set cached user data
 */
export function setUser(userId, data, app, ttl) {
  if (!userId || !data) return;
  const c = getInstance(app);
  if (!c || typeof c.set !== 'function') return;
  ttl ? c.set(userId, data, ttl) : c.set(userId, data);
}

/**
 * Invalidate cache for a user
 */
export function invalidateUser(userId, app = null) {
  if (!userId) return;
  const c = getInstance(app);
  if (c && typeof c.delete === 'function') c.delete(userId);
}

/**
 * Invalidate cache for multiple users
 */
export function invalidateUsers(userIds, app = null) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  const c = getInstance(app);
  if (c && typeof c.delete === 'function') userIds.forEach(id => c.delete(id));
}

/**
 * Invalidate all cached data
 */
export function invalidateAll(app = null) {
  const c = getInstance(app);
  if (c && typeof c.clear === 'function') c.clear();
}

// ========================================================================
// PUBLIC API - Cache Management
// ========================================================================

/**
 * Get cache statistics
 */
export function stats(app) {
  const c = getInstance(app);
  return c && typeof c.stats === 'function' ? c.stats() : null;
}

/**
 * Cleanup expired entries
 */
export function cleanup(app) {
  const c = getInstance(app);
  return c && typeof c.cleanup === 'function' ? c.cleanup() : 0;
}
