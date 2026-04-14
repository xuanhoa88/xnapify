/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

import cache, {
  createFactory,
  FileCache,
  InvalidCacheError,
  InvalidCacheTypeError,
  InvalidNamespaceError,
  MemoryCache,
  NoOpCache,
  withNamespace,
} from '.';

// ======================================================================
// Helpers
// ======================================================================

const TEST_CACHE_DIR = path.join(process.cwd(), '.xnapify', 'test-caches');

function cleanDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // Ignore
  }
}

// ======================================================================
// Tests
// ======================================================================

describe('Cache Engine', () => {
  // ====================================================================
  // Default Instance (Memory Cache)
  // ====================================================================

  describe('Default Instance', () => {
    beforeEach(() => {
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
        cache.set('expired-key', 'value', 1);

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

  // ====================================================================
  // createFactory()
  // ====================================================================

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
        directory: path.join(TEST_CACHE_DIR, 'factory-test'),
      });

      expect(instance).toBeDefined();
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

    it('should throw InvalidCacheTypeError for unsupported type', () => {
      expect(() => createFactory({ type: 'redis' })).toThrow(
        InvalidCacheTypeError,
      );
    });

    it('should register signal handlers', () => {
      const spy = jest.spyOn(process, 'once');
      createFactory();
      expect(spy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      spy.mockRestore();
    });
  });

  // ====================================================================
  // withNamespace()
  // ====================================================================

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

    it('should support nested namespaces', () => {
      const apiCache = cache.withNamespace('api');
      const userApiCache = apiCache.withNamespace('users');

      userApiCache.set('123', 'nested-data');

      // Should be stored with full prefix in base cache
      const keys = cache.keys();
      expect(keys).toContain('api:users:123');

      // Should be retrievable via nested namespaced cache
      expect(userApiCache.get('123')).toBe('nested-data');
    });

    describe('validation', () => {
      it('should throw InvalidNamespaceError for empty string', () => {
        expect(() => withNamespace('', cache)).toThrow(InvalidNamespaceError);
      });

      it('should throw InvalidNamespaceError for null', () => {
        expect(() => withNamespace(null, cache)).toThrow(InvalidNamespaceError);
      });

      it('should throw InvalidNamespaceError for whitespace-only', () => {
        expect(() => withNamespace('   ', cache)).toThrow(
          InvalidNamespaceError,
        );
      });

      it('should throw InvalidNamespaceError for too-long namespace', () => {
        const longNamespace = 'a'.repeat(101);
        expect(() => withNamespace(longNamespace, cache)).toThrow(
          InvalidNamespaceError,
        );
      });

      it('should throw InvalidCacheError for missing base cache', () => {
        expect(() => withNamespace('test', null)).toThrow(InvalidCacheError);
      });

      it('should throw InvalidCacheError for invalid base cache', () => {
        expect(() => withNamespace('test', { foo: 'bar' })).toThrow(
          InvalidCacheError,
        );
      });
    });
  });

  // ====================================================================
  // LRU Eviction
  // ====================================================================

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

  // ====================================================================
  // File Cache Adapter
  // ====================================================================

  describe('FileCache', () => {
    let fileCache;
    const fileCacheDir = path.join(TEST_CACHE_DIR, 'file-adapter-test');

    beforeEach(async () => {
      cleanDir(fileCacheDir);
      fileCache = new FileCache({
        directory: fileCacheDir,
        maxSize: 100,
        ttl: 60000,
      });
      await fileCache.ready;
    });

    afterEach(async () => {
      await fileCache.clear();
      cleanDir(fileCacheDir);
    });

    it('should create cache directory on construction', async () => {
      expect(fs.existsSync(fileCacheDir)).toBe(true);
    });

    describe('get()', () => {
      it('should return null for non-existent key', async () => {
        const value = await fileCache.get('missing');
        expect(value).toBeNull();
      });

      it('should return stored value', async () => {
        await fileCache.set('key', 'value');
        const result = await fileCache.get('key');
        expect(result).toBe('value');
      });

      it('should return null for expired key', async () => {
        await fileCache.set('expired', 'value', 1);

        await new Promise(resolve => setTimeout(resolve, 10));
        const result = await fileCache.get('expired');
        expect(result).toBeNull();
      });

      it('should handle complex objects', async () => {
        const obj = { name: 'test', nested: { arr: [1, 2, 3] } };
        await fileCache.set('complex', obj);
        const result = await fileCache.get('complex');
        expect(result).toEqual(obj);
      });
    });

    describe('set()', () => {
      it('should store value to disk', async () => {
        await fileCache.set('persist', 'disk-value');

        // Verify file exists on disk
        const files = fs.readdirSync(fileCacheDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        expect(jsonFiles.length).toBe(1);

        // Verify content
        const content = JSON.parse(
          fs.readFileSync(path.join(fileCacheDir, jsonFiles[0]), 'utf8'),
        );
        expect(content.key).toBe('persist');
        expect(content.value).toBe('disk-value');
      });

      it('should update existing value', async () => {
        await fileCache.set('key', 'old');
        await fileCache.set('key', 'new');
        const result = await fileCache.get('key');
        expect(result).toBe('new');
      });

      it('should use atomic writes (temp + rename)', async () => {
        await fileCache.set('atomic-test', 'safe-write');

        // No .tmp files should remain
        const files = fs.readdirSync(fileCacheDir);
        const tmpFiles = files.filter(f => f.includes('.tmp'));
        expect(tmpFiles.length).toBe(0);
      });
    });

    describe('delete()', () => {
      it('should delete existing key', async () => {
        await fileCache.set('del-key', 'value');
        const result = await fileCache.delete('del-key');
        expect(result).toBe(true);

        const value = await fileCache.get('del-key');
        expect(value).toBeNull();
      });

      it('should return false for non-existent key', async () => {
        const result = await fileCache.delete('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('has()', () => {
      it('should return true for existing key', async () => {
        await fileCache.set('exists', 'value');
        const result = await fileCache.has('exists');
        expect(result).toBe(true);
      });

      it('should return false for missing key', async () => {
        const result = await fileCache.has('missing');
        expect(result).toBe(false);
      });

      it('should return false for expired key', async () => {
        await fileCache.set('expired', 'value', 1);
        await new Promise(resolve => setTimeout(resolve, 10));
        const result = await fileCache.has('expired');
        expect(result).toBe(false);
      });
    });

    describe('clear()', () => {
      it('should remove all entries', async () => {
        await fileCache.set('a', 1);
        await fileCache.set('b', 2);
        await fileCache.set('c', 3);

        await fileCache.clear();

        const keys = await fileCache.keys();
        expect(keys).toEqual([]);
      });
    });

    describe('keys()', () => {
      it('should return original cache keys', async () => {
        await fileCache.set('user:1', 'data1');
        await fileCache.set('user:2', 'data2');

        const keys = await fileCache.keys();
        expect(keys).toContain('user:1');
        expect(keys).toContain('user:2');
        expect(keys.length).toBe(2);
      });

      it('should return empty array for empty cache', async () => {
        const keys = await fileCache.keys();
        expect(keys).toEqual([]);
      });
    });

    describe('stats()', () => {
      it('should return file cache statistics', async () => {
        await fileCache.set('valid-key', 'value', 60000);

        const stats = await fileCache.stats();
        expect(stats.type).toBe('file');
        expect(stats.directory).toBe(fileCacheDir);
        expect(stats.totalEntries).toBe(1);
        expect(stats.validEntries).toBe(1);
        expect(stats.expiredEntries).toBe(0);
        expect(stats).toHaveProperty('maxSize');
        expect(stats).toHaveProperty('defaultTTL');
        expect(stats).toHaveProperty('activeLocks');
      });
    });

    describe('cleanup()', () => {
      it('should remove expired entries', async () => {
        await fileCache.set('valid', 'value', 60000);
        await fileCache.set('expired1', 'value', 1);
        await fileCache.set('expired2', 'value', 1);

        await new Promise(resolve => setTimeout(resolve, 10));
        const removed = await fileCache.cleanup();

        expect(removed).toBe(2);
        const keys = await fileCache.keys();
        expect(keys).toContain('valid');
        expect(keys.length).toBe(1);
      });

      it('should return 0 when no expired entries', async () => {
        await fileCache.set('key', 'value', 60000);
        const removed = await fileCache.cleanup();
        expect(removed).toBe(0);
      });
    });

    describe('getSize()', () => {
      it('should return entry count', async () => {
        expect(await fileCache.getSize()).toBe(0);

        await fileCache.set('a', 1);
        expect(await fileCache.getSize()).toBe(1);

        await fileCache.set('b', 2);
        expect(await fileCache.getSize()).toBe(2);

        await fileCache.delete('a');
        expect(await fileCache.getSize()).toBe(1);
      });
    });

    describe('concurrency (async mutex)', () => {
      it('should handle concurrent writes to same key', async () => {
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(fileCache.set('race-key', `value-${i}`));
        }
        await Promise.all(promises);

        // Should have exactly one file, with the last writer winning
        const value = await fileCache.get('race-key');
        expect(value).toBeDefined();
        expect(value).not.toBeNull();
      });

      it('should handle concurrent operations on different keys', async () => {
        await Promise.all([
          fileCache.set('key-a', 'value-a'),
          fileCache.set('key-b', 'value-b'),
          fileCache.set('key-c', 'value-c'),
        ]);

        const [a, b, c] = await Promise.all([
          fileCache.get('key-a'),
          fileCache.get('key-b'),
          fileCache.get('key-c'),
        ]);

        expect(a).toBe('value-a');
        expect(b).toBe('value-b');
        expect(c).toBe('value-c');
      });
    });

    describe('eviction', () => {
      it('should evict oldest entries when at max size', async () => {
        const tinyCache = new FileCache({
          directory: path.join(TEST_CACHE_DIR, 'eviction-test'),
          maxSize: 3,
          ttl: 60000,
        });
        await tinyCache.ready;

        await tinyCache.set('old1', 'value1');
        await tinyCache.set('old2', 'value2');
        await tinyCache.set('old3', 'value3');
        // This should trigger eviction
        await tinyCache.set('new1', 'value4');

        const size = await tinyCache.getSize();
        // After eviction of 10% (min 1), size should be <= maxSize
        expect(size).toBeLessThanOrEqual(3);

        await tinyCache.clear();
        cleanDir(path.join(TEST_CACHE_DIR, 'eviction-test'));
      });
    });
  });

  // ====================================================================
  // NoOp Cache Adapter
  // ====================================================================

  describe('NoOpCache', () => {
    let noopCache;

    beforeEach(() => {
      noopCache = new NoOpCache();
    });

    it('get() should return null', () => {
      expect(noopCache.get('any-key')).toBeNull();
    });

    it('set() should be a no-op', () => {
      noopCache.set('key', 'value');
      expect(noopCache.get('key')).toBeNull();
    });

    it('delete() should return true', () => {
      expect(noopCache.delete('key')).toBe(true);
    });

    it('has() should return false', () => {
      expect(noopCache.has('key')).toBe(false);
    });

    it('keys() should return empty array', () => {
      expect(noopCache.keys()).toEqual([]);
    });

    it('size should return 0', () => {
      expect(noopCache.size).toBe(0);
    });

    it('cleanup() should return 0', () => {
      expect(noopCache.cleanup()).toBe(0);
    });

    it('stats() should match standardized shape', () => {
      const stats = noopCache.stats();
      expect(stats.type).toBe('noop');
      expect(stats.totalEntries).toBe(0);
      expect(stats.validEntries).toBe(0);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.maxSize).toBe(0);
      expect(stats.defaultTTL).toBe(0);
    });
  });

  // ====================================================================
  // Error Classes
  // ====================================================================

  describe('Error Classes', () => {
    it('InvalidCacheTypeError should have correct properties', () => {
      const err = new InvalidCacheTypeError('redis');
      expect(err.name).toBe('InvalidCacheTypeError');
      expect(err.code).toBe('INVALID_CACHE_TYPE');
      expect(err.statusCode).toBe(400);
      expect(err.timestamp).toBeDefined();
      expect(err.message).toContain('redis');
      expect(err).toBeInstanceOf(Error);
    });

    it('InvalidNamespaceError should have correct properties', () => {
      const err = new InvalidNamespaceError('empty namespace');
      expect(err.name).toBe('InvalidNamespaceError');
      expect(err.code).toBe('INVALID_NAMESPACE');
      expect(err.statusCode).toBe(400);
      expect(err.timestamp).toBeDefined();
    });

    it('InvalidCacheError should have correct properties', () => {
      const err = new InvalidCacheError('missing cache');
      expect(err.name).toBe('InvalidCacheError');
      expect(err.code).toBe('INVALID_CACHE');
      expect(err.statusCode).toBe(400);
    });
  });

  // ====================================================================
  // Exports
  // ====================================================================

  describe('Exports', () => {
    it('should export MemoryCache class', () => {
      expect(MemoryCache).toBeDefined();
      const instance = new MemoryCache({ maxSize: 10 });
      expect(instance).toBeInstanceOf(MemoryCache);
    });

    it('should export FileCache class', () => {
      expect(FileCache).toBeDefined();
    });

    it('should export NoOpCache class', () => {
      expect(NoOpCache).toBeDefined();
      const instance = new NoOpCache();
      expect(instance).toBeInstanceOf(NoOpCache);
    });

    it('should export createFactory function', () => {
      expect(typeof createFactory).toBe('function');
    });

    it('should export withNamespace function', () => {
      expect(typeof withNamespace).toBe('function');
    });
  });
});
