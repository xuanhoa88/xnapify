/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ======================================================================
// Constants
// ======================================================================

const EVICTION_PERCENT = 0.1;

/**
 * File Cache Adapter
 *
 * File-based cache implementation with:
 * - Persistent storage across restarts
 * - TTL-based expiration
 * - Atomic writes (temp file + rename)
 * - Async mutex per key to prevent race conditions
 * - Max size limit with LRU-like eviction
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
 * - size: (getter, sync fallback)
 */
export default class FileCache {
  /**
   * Create a new file cache instance
   *
   * @param {Object} options
   * @param {string} [options.directory] - Cache directory path
   * @param {number} [options.maxSize=10000] - Maximum cache files
   * @param {number} [options.ttl=300000] - Default TTL in ms (5 min)
   */
  constructor(options = {}) {
    this.directory =
      options.directory ||
      process.env.XNAPIFY_CACHE_DIR ||
      path.join(
        process.env.NODE_ENV === 'production' ? os.homedir() : process.cwd(),
        '.xnapify',
        'caches',
      );
    this.maxSize = options.maxSize || 10_000;
    this.defaultTTL = options.ttl || 5 * 60 * 1000; // 5 minutes

    // Async mutex: maps key → Promise chain
    this.lockQueues = new Map();

    // Track pending initialization
    this.ready = this.ensureDirectory();
  }

  // ====================================================================
  // Directory & File Helpers
  // ====================================================================

  /**
   * Ensure cache directory exists
   * @returns {Promise<void>}
   */
  async ensureDirectory() {
    try {
      await fs.promises.access(this.directory);
    } catch {
      await fs.promises.mkdir(this.directory, { recursive: true });
    }
  }

  /**
   * Generate safe filename from key using SHA-256
   *
   * @param {string} key - Cache key
   * @returns {string} Safe filename path
   */
  getFilename(key) {
    const hash = crypto
      .createHash('sha256')
      .update(key)
      .digest('hex')
      .slice(0, 32);
    return path.join(this.directory, `${hash}.json`);
  }

  // ====================================================================
  // Async Mutex (per-key)
  // ====================================================================

  /**
   * Execute a function with an exclusive lock on the given key.
   * Queues concurrent calls for the same key — no busy-wait.
   *
   * @param {string} key - Lock key
   * @param {Function} fn - Async function to execute under lock
   * @returns {Promise<*>} Result of fn
   */
  async withLock(key, fn) {
    // Chain this operation after the current pending operation for this key
    const prev = this.lockQueues.get(key) || Promise.resolve();
    let releaseFn;

    const next = new Promise(resolve => {
      releaseFn = resolve;
    });

    // Register our lock in the queue before awaiting
    const operation = prev.then(async () => {
      try {
        return await fn();
      } finally {
        releaseFn();
      }
    });

    this.lockQueues.set(key, next);

    // Clean up the queue entry when our lock is released
    next.then(() => {
      if (this.lockQueues.get(key) === next) {
        this.lockQueues.delete(key);
      }
    });

    return operation;
  }

  // ====================================================================
  // File I/O Helpers
  // ====================================================================

  /**
   * Read and parse a cache file
   *
   * @param {string} filename - File path
   * @returns {Promise<Object|null>} Parsed data or null
   */
  async readFile(filename) {
    try {
      const content = await fs.promises.readFile(filename, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      // Corrupted file
      if (err instanceof SyntaxError) return null;
      throw err;
    }
  }

  /**
   * Atomically write a cache file (temp + rename)
   *
   * @param {string} filename - Target file path
   * @param {Object} data - Data to write
   * @returns {Promise<void>}
   */
  async writeFile(filename, data) {
    const tmpFile = `${filename}.tmp.${Date.now()}`;
    await fs.promises.writeFile(tmpFile, JSON.stringify(data), 'utf8');
    await fs.promises.rename(tmpFile, filename);
  }

  /**
   * Delete a cache file safely
   *
   * @param {string} filename - File path
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteFile(filename) {
    try {
      await fs.promises.unlink(filename);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }

  /**
   * Get list of cache files
   *
   * @returns {Promise<string[]>} Array of filenames
   */
  async getCacheFiles() {
    try {
      const files = await fs.promises.readdir(this.directory);
      return files.filter(f => f.endsWith('.json'));
    } catch {
      return [];
    }
  }

  // ====================================================================
  // Public API — Cache Interface
  // ====================================================================

  /**
   * Get a value from cache
   *
   * @param {string} key - Cache key
   * @returns {Promise<*>} Cached value or null if not found/expired
   */
  async get(key) {
    await this.ready;
    return this.withLock(key, async () => {
      const filename = this.getFilename(key);
      const data = await this.readFile(filename);
      if (!data) return null;

      // Check if expired
      if (Date.now() > data.expiresAt) {
        await this.deleteFile(filename);
        return null;
      }

      return data.value;
    });
  }

  /**
   * Set a value in cache with atomic write
   *
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - TTL in ms (optional, uses default)
   * @returns {Promise<void>}
   */
  async set(key, value, ttl = this.defaultTTL) {
    await this.ready;
    return this.withLock(key, async () => {
      // Check max size and evict if needed
      await this.evictIfNeeded();

      const filename = this.getFilename(key);
      const now = Date.now();
      const data = {
        key,
        value,
        expiresAt: now + ttl,
        createdAt: now,
      };

      await this.writeFile(filename, data);
    });
  }

  /**
   * Delete a value from cache
   *
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(key) {
    await this.ready;
    return this.withLock(key, async () => {
      return this.deleteFile(this.getFilename(key));
    });
  }

  /**
   * Check if key exists and is not expired
   *
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async has(key) {
    await this.ready;
    return this.withLock(key, async () => {
      const filename = this.getFilename(key);
      const data = await this.readFile(filename);
      if (!data) return false;

      if (Date.now() > data.expiresAt) {
        await this.deleteFile(filename);
        return false;
      }

      return true;
    });
  }

  /**
   * Clear all entries
   *
   * @returns {Promise<void>}
   */
  async clear() {
    await this.ready;
    try {
      const files = await this.getCacheFiles();
      await Promise.all(
        files.map(file => this.deleteFile(path.join(this.directory, file))),
      );
      this.lockQueues.clear();
    } catch (error) {
      console.error('[Cache:file] Clear error:', error.message);
    }
  }

  /**
   * Evict oldest entries if at max size
   *
   * @returns {Promise<void>}
   */
  async evictIfNeeded() {
    try {
      const files = await this.getCacheFiles();
      if (files.length < this.maxSize) return;

      // Read all files to sort by creation time
      const fileEntries = [];
      for (const file of files) {
        const filepath = path.join(this.directory, file);
        try {
          const data = await this.readFile(filepath);
          fileEntries.push({
            file,
            createdAt: (data && data.createdAt) || 0,
            filepath,
          });
        } catch {
          fileEntries.push({ file, createdAt: 0, filepath });
        }
      }

      fileEntries.sort((a, b) => a.createdAt - b.createdAt);

      // Remove oldest 10% or at least 1 entry
      const toRemove = Math.max(1, Math.floor(files.length * EVICTION_PERCENT));
      for (let i = 0; i < toRemove && i < fileEntries.length; i++) {
        await this.deleteFile(fileEntries[i].filepath);
      }
    } catch (error) {
      console.error('[Cache:file] Evict error:', error.message);
    }
  }

  /**
   * Get cache statistics
   *
   * @returns {Promise<Object>} Cache stats
   */
  async stats() {
    await this.ready;
    try {
      const files = await this.getCacheFiles();
      let validCount = 0;
      let expiredCount = 0;
      const now = Date.now();

      for (const file of files) {
        const data = await this.readFile(path.join(this.directory, file));
        if (!data || now > data.expiresAt) {
          expiredCount++;
        } else {
          validCount++;
        }
      }

      return {
        type: 'file',
        directory: this.directory,
        totalEntries: files.length,
        validEntries: validCount,
        expiredEntries: expiredCount,
        maxSize: this.maxSize,
        defaultTTL: this.defaultTTL,
        activeLocks: this.lockQueues.size,
      };
    } catch (error) {
      return {
        type: 'file',
        directory: this.directory,
        error: error.message,
      };
    }
  }

  /**
   * Clean up expired entries
   *
   * @returns {Promise<number>} Number of entries removed
   */
  async cleanup() {
    await this.ready;
    try {
      const files = await this.getCacheFiles();
      const now = Date.now();
      let removed = 0;

      for (const file of files) {
        const filepath = path.join(this.directory, file);
        const data = await this.readFile(filepath);

        if (!data) {
          // Remove corrupted files
          await this.deleteFile(filepath);
          removed++;
        } else if (now > data.expiresAt) {
          await this.deleteFile(filepath);
          removed++;
        }
      }

      // Clean up stale lock queues
      const staleKeys = [];
      this.lockQueues.forEach((_promise, key) => {
        staleKeys.push(key);
      });

      if (removed > 0) {
        console.info(`[Cache:file] Removed ${removed} expired entries`);
      }

      return removed;
    } catch (error) {
      console.error('[Cache:file] Cleanup error:', error.message);
      return 0;
    }
  }

  /**
   * Get all keys
   *
   * @returns {Promise<string[]>} Array of original cache keys
   */
  async keys() {
    await this.ready;
    try {
      const files = await this.getCacheFiles();
      const keys = [];

      for (const file of files) {
        const data = await this.readFile(path.join(this.directory, file));
        if (data && data.key) keys.push(data.key);
      }

      return keys;
    } catch {
      return [];
    }
  }

  /**
   * Get cache size (async)
   *
   * @returns {Promise<number>} Current number of entries
   */
  async getSize() {
    await this.ready;
    const files = await this.getCacheFiles();
    return files.length;
  }

  /**
   * Get cache size (sync fallback — uses readdirSync)
   * Prefer getSize() for non-blocking usage.
   *
   * @returns {number} Current number of entries
   */
  get size() {
    try {
      return fs.readdirSync(this.directory).filter(f => f.endsWith('.json'))
        .length;
    } catch {
      return 0;
    }
  }
}
