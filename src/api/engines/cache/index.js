/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import MemoryCache from './adapters/memory';
import FileCache from './adapters/file';

/**
 * Cache Factory
 *
 * Creates cache instances based on configuration.
 * Supports multiple adapters: memory (default), file.
 *
 * @param {Object} options
 * @param {string} [options.type='memory'] - Cache type ('memory', 'file')
 * @param {number} [options.maxSize=1000] - Max entries (memory only)
 * @param {string} [options.directory] - Cache directory (file only)
 * @param {number} [options.ttl=300000] - Default TTL in ms (5 min)
 * @returns {Object} Cache instance
 */
function cacheFactory(options = {}) {
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
 * Create a namespaced cache
 *
 * Creates a cache instance with key prefixing for isolation.
 *
 * @param {string} namespace - Namespace prefix for keys
 * @param {Object} baseCache - Base cache instance
 * @returns {Object} Namespaced cache wrapper
 */
cacheFactory.withNamespace = function (namespace, baseCache) {
  const prefix = `${namespace}:`;

  return {
    get: key => baseCache.get(`${prefix}${key}`),
    set: (key, value, ttl) => baseCache.set(`${prefix}${key}`, value, ttl),
    delete: key => baseCache.delete(`${prefix}${key}`),
    has: key => baseCache.has(`${prefix}${key}`),
    clear: () => {
      // Only clear keys with this namespace prefix
      const keys = baseCache.keys ? baseCache.keys() : [];
      keys.filter(k => k.startsWith(prefix)).forEach(k => baseCache.delete(k));
    },
    stats: () => baseCache.stats(),
    cleanup: () => baseCache.cleanup(),
  };
};

// Export default cache factory
export default cacheFactory;
