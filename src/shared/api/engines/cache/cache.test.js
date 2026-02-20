/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import cache, { createFactory, withNamespace } from '.';

describe('Cache Engine', () => {
  describe('Default Instance', () => {
    beforeEach(() => {
      // Clear cache before each test
      cache.clear();
    });

    it('should be a memory cache instance', () => {
      expect(cache).toBeDefined();
      expect(cache).toHaveProperty('get');
      expect(cache).toHaveProperty('set');
      expect(cache).toHaveProperty('delete');
      expect(cache).toHaveProperty('has');
      expect(cache).toHaveProperty('clear');
      expect(cache).toHaveProperty('stats');
      expect(cache).toHaveProperty('cleanup');
    });

    it('should have withNamespace method attached', () => {
      expect(cache.withNamespace).toBeDefined();
      expect(typeof cache.withNamespace).toBe('function');
    });

    describe('get()', () => {
      it('should return null for non-existent key', () => {
        const value = cache.get('non-existent');
        expect(value).toBeNull();
      });

      it('should return stored value', () => {
        cache.set('test-key', 'test-value');
        const value = cache.get('test-key');
        expect(value).toBe('test-value');
      });

      it('should return null for expired key', () => {
        // Set with very short TTL
        cache.set('expired-key', 'value', 1);

        // Wait for expiration
        return new Promise(resolve => {
          setTimeout(() => {
            const value = cache.get('expired-key');
            expect(value).toBeNull();
            resolve();
          }, 10);
        });
      });

      it('should handle complex objects', () => {
        const obj = { name: 'test', nested: { value: 123 } };
        cache.set('object-key', obj);
        const retrieved = cache.get('object-key');
        expect(retrieved).toEqual(obj);
      });
    });

    describe('set()', () => {
      it('should store value', () => {
        cache.set('key', 'value');
        expect(cache.get('key')).toBe('value');
      });

      it('should store with custom TTL', () => {
        cache.set('key', 'value', 1000);
        expect(cache.get('key')).toBe('value');
      });

      it('should update existing value', () => {
        cache.set('key', 'old-value');
        cache.set('key', 'new-value');
        expect(cache.get('key')).toBe('new-value');
      });

      it('should enforce max size', () => {
        // Create cache with small max size
        const smallCache = createFactory({ maxSize: 3 });

        smallCache.set('key1', 'value1');
        smallCache.set('key2', 'value2');
        smallCache.set('key3', 'value3');
        smallCache.set('key4', 'value4'); // Should evict key1 (LRU)

        expect(smallCache.get('key1')).toBeNull();
        expect(smallCache.get('key2')).toBe('value2');
        expect(smallCache.get('key3')).toBe('value3');
        expect(smallCache.get('key4')).toBe('value4');
      });
    });

    describe('delete()', () => {
      it('should delete existing key', () => {
        cache.set('key', 'value');
        const result = cache.delete('key');
        expect(result).toBe(true);
        expect(cache.get('key')).toBeNull();
      });

      it('should return false for non-existent key', () => {
        const result = cache.delete('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('has()', () => {
      it('should return true for existing key', () => {
        cache.set('key', 'value');
        expect(cache.has('key')).toBe(true);
      });

      it('should return false when checking non-existent key', () => {
        expect(cache.has('non-existent')).toBe(false);
      });

      it('should return false for expired key', () => {
        cache.set('expired', 'value', 1);

        return new Promise(resolve => {
          setTimeout(() => {
            expect(cache.has('expired')).toBe(false);
            resolve();
          }, 10);
        });
      });
    });

    describe('clear()', () => {
      it('should remove all entries', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');

        cache.clear();

        expect(cache.get('key1')).toBeNull();
        expect(cache.get('key2')).toBeNull();
        expect(cache.get('key3')).toBeNull();
        expect(cache.size).toBe(0);
      });
    });

    describe('stats()', () => {
      it('should return cache statistics', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');

        const stats = cache.stats();

        expect(stats).toHaveProperty('type', 'memory');
        expect(stats).toHaveProperty('totalEntries');
        expect(stats).toHaveProperty('validEntries');
        expect(stats).toHaveProperty('expiredEntries');
        expect(stats).toHaveProperty('maxSize');
        expect(stats).toHaveProperty('defaultTTL');
        expect(stats.totalEntries).toBe(2);
      });

      it('should count expired entries', () => {
        cache.set('valid', 'value', 60000);
        cache.set('expired', 'value', 1);

        return new Promise(resolve => {
          setTimeout(() => {
            const stats = cache.stats();
            expect(stats.validEntries).toBe(1);
            expect(stats.expiredEntries).toBe(1);
            resolve();
          }, 10);
        });
      });
    });

    describe('cleanup()', () => {
      it('should remove expired entries', () => {
        cache.set('valid', 'value', 60000);
        cache.set('expired1', 'value', 1);
        cache.set('expired2', 'value', 1);

        return new Promise(resolve => {
          setTimeout(() => {
            const removed = cache.cleanup();
            expect(removed).toBe(2);
            expect(cache.size).toBe(1);
            resolve();
          }, 10);
        });
      });

      it('should return 0 when no expired entries', () => {
        cache.set('key', 'value', 60000);
        const removed = cache.cleanup();
        expect(removed).toBe(0);
      });
    });

    describe('keys()', () => {
      it('should return all cache keys', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');

        const keys = cache.keys();
        expect(keys).toEqual(['key1', 'key2', 'key3']);
      });

      it('should return empty array for empty cache', () => {
        const keys = cache.keys();
        expect(keys).toEqual([]);
      });
    });

    describe('size', () => {
      it('should return number of entries', () => {
        expect(cache.size).toBe(0);

        cache.set('key1', 'value1');
        expect(cache.size).toBe(1);

        cache.set('key2', 'value2');
        expect(cache.size).toBe(2);

        cache.delete('key1');
        expect(cache.size).toBe(1);
      });
    });
  });

  describe('createFactory()', () => {
    it('should create memory cache by default', () => {
      const instance = createFactory();
      expect(instance).toBeDefined();
      expect(instance.stats().type).toBe('memory');
    });

    it('should create memory cache with custom config', () => {
      const instance = createFactory({
        type: 'memory',
        maxSize: 500,
        ttl: 10000,
      });

      const stats = instance.stats();
      expect(stats.type).toBe('memory');
      expect(stats.maxSize).toBe(500);
      expect(stats.defaultTTL).toBe(10000);
    });

    it('should create file cache when specified', () => {
      const instance = createFactory({
        type: 'file',
        directory: '/tmp/test-cache',
      });

      expect(instance).toBeDefined();
      // File cache should have the same interface
      expect(instance).toHaveProperty('get');
      expect(instance).toHaveProperty('set');
    });

    it('should create independent instances', () => {
      const cache1 = createFactory();
      const cache2 = createFactory();

      cache1.set('key', 'value1');
      cache2.set('key', 'value2');

      expect(cache1.get('key')).toBe('value1');
      expect(cache2.get('key')).toBe('value2');
    });
  });

  describe('withNamespace()', () => {
    beforeEach(() => {
      cache.clear();
    });

    it('should create namespaced cache from default instance', () => {
      const userCache = cache.withNamespace('users');

      expect(userCache).toBeDefined();
      expect(userCache).toHaveProperty('get');
      expect(userCache).toHaveProperty('set');
    });

    it('should prefix keys with namespace', () => {
      const userCache = cache.withNamespace('users');

      userCache.set('123', { name: 'John' });

      // Check that the key is prefixed in base cache
      const keys = cache.keys();
      expect(keys).toContain('users:123');

      // But get works without prefix in namespaced cache
      expect(userCache.get('123')).toEqual({ name: 'John' });
    });

    it('should isolate namespaced caches', () => {
      const userCache = cache.withNamespace('users');
      const postCache = cache.withNamespace('posts');

      userCache.set('1', 'user-data');
      postCache.set('1', 'post-data');

      expect(userCache.get('1')).toBe('user-data');
      expect(postCache.get('1')).toBe('post-data');

      // Different keys in base cache
      const keys = cache.keys();
      expect(keys).toContain('users:1');
      expect(keys).toContain('posts:1');
    });

    it('should clear only namespaced keys', () => {
      const userCache = cache.withNamespace('users');
      const postCache = cache.withNamespace('posts');

      userCache.set('1', 'user1');
      userCache.set('2', 'user2');
      postCache.set('1', 'post1');

      userCache.clear();

      expect(userCache.get('1')).toBeNull();
      expect(userCache.get('2')).toBeNull();
      expect(postCache.get('1')).toBe('post1');
    });

    it('should work with custom base cache', () => {
      const customCache = createFactory({ maxSize: 10 });
      const namespacedCache = withNamespace('custom', customCache);

      namespacedCache.set('key', 'value');

      expect(namespacedCache.get('key')).toBe('value');
      expect(customCache.keys()).toContain('custom:key');
    });

    it('should support stats from base cache', () => {
      const userCache = withNamespace('users', cache);

      userCache.set('1', 'data');

      const stats = userCache.stats();
      expect(stats).toBeDefined();
      expect(stats.type).toBe('memory');
    });

    it('should support cleanup from base cache', () => {
      const userCache = cache.withNamespace('users');

      userCache.set('expired', 'value', 1);

      return new Promise(resolve => {
        setTimeout(() => {
          const removed = userCache.cleanup();
          expect(removed).toBeGreaterThanOrEqual(0);
          resolve();
        }, 10);
      });
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entries', () => {
      const lruCache = createFactory({ maxSize: 3 });

      lruCache.set('a', 1);
      lruCache.set('b', 2);
      lruCache.set('c', 3);

      // Access 'a' to make it recently used
      lruCache.get('a');

      // Add new entry - should evict 'b' (least recently used)
      lruCache.set('d', 4);

      expect(lruCache.get('b')).toBeNull();
      expect(lruCache.get('a')).toBe(1);
      expect(lruCache.get('c')).toBe(3);
      expect(lruCache.get('d')).toBe(4);
    });

    it('should update LRU on set', () => {
      const lruCache = createFactory({ maxSize: 3 });

      lruCache.set('a', 1);
      lruCache.set('b', 2);
      lruCache.set('c', 3);

      // Update 'a' to make it recently used
      lruCache.set('a', 'updated');

      // Add new entry - should evict 'b' (least recently used)
      lruCache.set('d', 4);

      expect(lruCache.get('b')).toBeNull();
      expect(lruCache.get('a')).toBe('updated');
    });
  });
});
