/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createFactory, withNamespace } from './factory';

/**
 * Cache Engine
 *
 * Provides caching with multiple adapters: memory (default), file.
 * Default export is a singleton memory cache instance.
 *
 * **Auto-disable in Development Mode:**
 * When __DEV__ is true, the cache automatically uses a NoOp adapter that doesn't
 * cache anything. This ensures fresh data on every request during development.
 *
 * @example
 * // Use default singleton instance directly
 * await cache.set('key', 'value', 60000); // 60s TTL
 * const value = await cache.get('key');
 * await cache.delete('key');
 *
 * @example
 * // Create custom instance with different config
 * const fileCache = createFactory({ type: 'file', directory: '/tmp/cache' });
 * await fileCache.set('key', 'value');
 *
 * @example
 * // Create namespaced cache from default instance
 * const userCache = cache.withNamespace('users');
 * await userCache.set('123', userData);
 *
 * @example
 * // Create namespaced cache from custom instance
 * const fileCache = createFactory({ type: 'file' });
 * const sessionCache = fileCache.withNamespace('sessions');
 * await sessionCache.set('abc', sessionData);
 *
 * @example
 * // Nested namespaces
 * const apiCache = cache.withNamespace('api');
 * const userApiCache = apiCache.withNamespace('users');
 * await userApiCache.set('123', data); // Stored as "api:users:123"
 */

// Export factory and namespace utility
export { createFactory, withNamespace };

// Export error classes
export {
  CacheError,
  InvalidCacheError,
  InvalidCacheTypeError,
  InvalidNamespaceError,
} from './errors';

// Export adapter classes
export { default as MemoryCache } from './adapters/memory';
export { default as FileCache } from './adapters/file';
export { default as NoOpCache } from './adapters/noop';

/**
 * Singleton instance of Cache Engine
 * Used by the application via app.container.resolve('cache')
 */
const cache = createFactory({
  type: 'memory',
  maxSize: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
});

export default cache;
