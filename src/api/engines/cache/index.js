/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import MemoryCache from './adapters/memory';
import FileCache from './adapters/file';

/**
 * Cache Engine
 *
 * Provides caching with multiple adapters: memory (default), file.
 * Default export is a singleton memory cache instance.
 *
 * @example
 * // Use default singleton instance directly
 * await cache.set('key', 'value', 60000); // 60s TTL
 * const value = await cache.get('key');
 * await cache.delete('key');
 *
 * @example
 * // Create custom instance with different config
 * const fileCache = cache.createFactory({ type: 'file', directory: '/tmp/cache' });
 * await fileCache.set('key', 'value');
 *
 * @example
 * // Create namespaced cache
 * const userCache = cache.withNamespace('users');
 * await userCache.set('123', userData);
 */

/**
 * Cache Factory
 *
 * @param {Object} options
 * @param {string} [options.type='memory'] - Cache type ('memory', 'file')
 * @param {number} [options.maxSize=1000] - Max entries (memory only)
 * @param {string} [options.directory] - Cache directory (file only)
 * @param {number} [options.ttl=300000] - Default TTL in ms (5 min)
 * @returns {Object} Cache instance
 */
export function createFactory(options = {}) {
  const { type = 'memory', ...config } = options;

  switch (type) {
    case 'file':
      return new FileCache(config);

    case 'memory':
    default:
      return new MemoryCache(config);
  }
}

/**
 * Create a namespaced cache from a base cache
 *
 * Creates a cache instance with key prefixing for isolation.
 *
 * @param {string} namespace - Namespace prefix for keys
 * @param {Object} [baseCache] - Base cache instance (uses default if not provided)
 * @returns {Object} Namespaced cache wrapper
 */
export function withNamespace(namespace, baseCache) {
  const base = baseCache || defaultCache;
  const prefix = `${namespace}:`;

  return {
    get: key => base.get(`${prefix}${key}`),
    set: (key, value, ttl) => base.set(`${prefix}${key}`, value, ttl),
    delete: key => base.delete(`${prefix}${key}`),
    has: key => base.has(`${prefix}${key}`),
    clear: () => {
      // Only clear keys with this namespace prefix
      const keys = base.keys ? base.keys() : [];
      keys.filter(k => k.startsWith(prefix)).forEach(k => base.delete(k));
    },
    stats: () => base.stats(),
    cleanup: () => base.cleanup(),
  };
}

/**
 * Default singleton memory cache instance
 */
const defaultCache = createFactory({
  type: 'memory',
  maxSize: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
});

// Attach namespace creator to default cache for convenience
defaultCache.withNamespace = namespace =>
  withNamespace(namespace, defaultCache);

// Default export is the singleton instance
export default defaultCache;
