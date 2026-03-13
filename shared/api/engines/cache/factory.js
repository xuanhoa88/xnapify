/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import FileCache from './adapters/file';
import MemoryCache from './adapters/memory';
import NoOpCache from './adapters/noop';

/**
 * Supported cache adapter types
 * @typedef {'memory' | 'file'} CacheType
 */

/**
 * @typedef {Object} CacheOptions
 * @property {CacheType} [type='memory'] - Cache adapter type
 * @property {number} [maxSize=1000] - Maximum entries (memory only)
 * @property {string} [directory] - Cache directory path (file only)
 * @property {number} [ttl=300000] - Default TTL in milliseconds (5 min)
 */

/**
 * @typedef {Object} CacheAdapter
 * @property {(key: string) => Promise<any>} get - Get value by key
 * @property {(key: string, value: any, ttl?: number) => Promise<void>} set - Set value with optional TTL
 * @property {(key: string) => Promise<boolean>} delete - Delete key
 * @property {(key: string) => Promise<boolean>} has - Check if key exists
 * @property {() => Promise<void>} clear - Clear all entries
 * @property {() => Array<string>} [keys] - Get all keys (optional)
 * @property {() => Object} [stats] - Get cache statistics (optional)
 * @property {() => Promise<void>} [cleanup] - Cleanup expired entries (optional)
 * @property {(namespace: string) => CacheAdapter} withNamespace - Create namespaced cache
 */

/**
 * Create a namespaced cache from a base cache
 *
 * This is a low-level function. Most users should use the instance method instead:
 * `cache.withNamespace('name')` rather than `withNamespace('name', cache)`.
 *
 * Creates a cache instance with automatic key prefixing for isolation.
 * All operations are scoped to the namespace, preventing key collisions.
 *
 * Note: Namespace delimiter is ':' - avoid using colons in your cache keys
 * to prevent conflicts with namespaced keys.
 *
 * @param {string} namespace - Namespace prefix for keys (must be non-empty)
 * @param {CacheAdapter} baseCache - Base cache instance (required)
 * @returns {CacheAdapter} Namespaced cache wrapper
 * @throws {Error} If namespace is empty, whitespace-only, or invalid
 * @throws {Error} If baseCache is not provided or invalid
 *
 * @example
 * // Preferred: Use instance method
 * const memCache = createFactory({ type: 'memory' });
 * const userCache = memCache.withNamespace('users');
 * await userCache.set('123', { name: 'John' }); // Stored as "users:123"
 *
 * @example
 * // Advanced: Use standalone function for dependency injection
 * const memCache = createFactory({ type: 'memory' });
 * const userCache = withNamespace('users', memCache);
 * await userCache.clear(); // Only clears keys with "users:" prefix
 */
export function withNamespace(namespace, baseCache) {
  // Validate namespace
  if (!namespace || typeof namespace !== 'string') {
    const err = new Error('Namespace must be a non-empty string');
    err.name = 'InvalidNamespaceError';
    err.status = 400;
    throw err;
  }

  const trimmed = namespace.trim();
  if (trimmed.length === 0) {
    const err = new Error('Namespace cannot be whitespace-only');
    err.name = 'InvalidNamespaceError';
    err.status = 400;
    throw err;
  }

  if (trimmed.length > 100) {
    const err = new Error('Namespace too long (maximum 100 characters)');
    err.name = 'InvalidNamespaceError';
    err.status = 400;
    throw err;
  }

  // Validate base cache
  if (!baseCache) {
    const err = new Error(
      'Base cache is required. Use cache.withNamespace() or provide a cache instance.',
    );
    err.name = 'InvalidCacheError';
    err.status = 400;
    throw err;
  }

  if (typeof baseCache.get !== 'function') {
    const err = new Error(
      'Base cache must be a valid cache adapter with required methods',
    );
    err.name = 'InvalidCacheError';
    err.status = 400;
    throw err;
  }

  const prefix = `${trimmed}:`;

  const namespacedCache = {
    get(key) {
      return baseCache.get(`${prefix}${key}`);
    },

    set(key, value, ttl) {
      return baseCache.set(`${prefix}${key}`, value, ttl);
    },

    delete(key) {
      return baseCache.delete(`${prefix}${key}`);
    },

    has(key) {
      return baseCache.has(`${prefix}${key}`);
    },

    clear() {
      if (typeof baseCache.keys === 'function') {
        const keys = baseCache.keys();

        // Handle if keys() returns a Promise (async adapters)
        if (keys instanceof Promise) {
          return keys.then(kList => {
            const namespacedKeys = kList.filter(k => k.startsWith(prefix));
            return Promise.all(namespacedKeys.map(k => baseCache.delete(k)));
          });
        }

        // Handle sync keys()
        const namespacedKeys = keys.filter(k => k.startsWith(prefix));
        const results = namespacedKeys.map(k => baseCache.delete(k));

        // If any delete() returns a promise, wait for all
        if (results.some(r => r instanceof Promise)) {
          return Promise.all(results);
        }

        // Return resolved promise for consistency
        return Promise.resolve();
      }

      // Fallback: clear entire cache if keys() not supported
      console.warn(
        `Cache adapter does not support keys(). Clearing entire cache instead of namespace "${trimmed}".`,
      );
      return baseCache.clear();
    },

    stats() {
      if (typeof baseCache.stats === 'function') {
        return baseCache.stats();
      }
      return null;
    },

    cleanup() {
      if (typeof baseCache.cleanup === 'function') {
        return baseCache.cleanup();
      }
      // Return resolved promise for consistent async behavior
      return Promise.resolve();
    },

    // Nested namespacing support
    withNamespace(childNamespace) {
      return withNamespace(`${prefix}${childNamespace}`, baseCache);
    },
  };

  return namespacedCache;
}

/**
 * Cache Factory
 *
 * Creates a cache instance with the specified adapter and configuration.
 * Each instance has a withNamespace method for creating scoped caches.
 *
 * **Auto-disable in Development Mode:**
 * When __DEV__ is true, the factory automatically creates a NoOp cache adapter
 * instead of the requested type. This ensures fresh data on every request during
 * development, preventing stale cached data from interfering with development.
 *
 * @param {CacheOptions} [options={}] - Cache configuration
 * @returns {CacheAdapter} Cache instance with withNamespace method
 * @throws {Error} If invalid cache type is specified (production mode only)
 *
 * @example
 * // Create memory cache (or NoOp cache if __DEV__ is true)
 * const memCache = createFactory({ type: 'memory', maxSize: 500 });
 * const userCache = memCache.withNamespace('users');
 * await userCache.set('123', { name: 'John' });
 *
 * @example
 * // Create file cache (or NoOp cache if __DEV__ is true)
 * const fileCache = createFactory({ type: 'file', directory: './cache' });
 * const sessionCache = fileCache.withNamespace('sessions');
 * await sessionCache.set('abc', { userId: '123' });
 *
 * @example
 * // Multiple namespaces from same instance
 * const cache = createFactory({ type: 'memory' });
 * const usersCache = cache.withNamespace('users');
 * const productsCache = cache.withNamespace('products');
 * // Keys are isolated: "users:..." and "products:..."
 */
export function createFactory(options = {}) {
  const { type = 'memory', ...config } = options;

  let adapter;

  // Auto-disable cache in development mode
  if (__DEV__) {
    adapter = new NoOpCache(config);
  } else {
    switch (type) {
      case 'file':
        adapter = new FileCache(config);
        break;

      case 'memory':
        adapter = new MemoryCache(config);
        break;

      default: {
        const err = new Error(
          `Invalid cache type: "${type}". Supported types: memory, file`,
        );
        err.name = 'InvalidCacheTypeError';
        err.status = 400;
        throw err;
      }
    }
  }

  // Attach withNamespace method to the adapter instance
  adapter.withNamespace = function (namespace) {
    return withNamespace(namespace, adapter);
  };

  return adapter;
}
