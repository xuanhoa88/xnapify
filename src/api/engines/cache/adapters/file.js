/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * File Cache Adapter
 *
 * File-based cache implementation with:
 * - Persistent storage across restarts
 * - TTL-based expiration
 * - Atomic writes (temp file + rename)
 * - In-memory lock to prevent race conditions
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
 * - size: Get number of entries
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
    this.directory = options.directory || path.join(process.cwd(), '.cache');
    this.maxSize = options.maxSize || 10000;
    this.defaultTTL = options.ttl || 5 * 60 * 1000; // 5 minutes
    this.locks = new Map(); // In-memory locks for race condition prevention

    // Ensure cache directory exists
    this.ensureDirectory();
  }

  /**
   * Ensure cache directory exists
   */
  ensureDirectory() {
    if (!fs.existsSync(this.directory)) {
      fs.mkdirSync(this.directory, { recursive: true });
    }
  }

  /**
   * Generate safe filename from key
   *
   * @param {string} key - Cache key
   * @returns {string} Safe filename
   */
  getFilename(key) {
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(this.directory, `${hash}.json`);
  }

  /**
   * Acquire lock for a key (simple spin lock)
   *
   * @param {string} key - Cache key
   * @param {number} timeout - Max wait time in ms
   * @returns {boolean} True if lock acquired
   */
  acquireLock(key, timeout = 5000) {
    const start = Date.now();
    while (this.locks.has(key)) {
      if (Date.now() - start > timeout) return false;
      // Busy wait (synchronous - minimal overhead for short locks)
    }
    this.locks.set(key, Date.now());
    return true;
  }

  /**
   * Release lock for a key
   *
   * @param {string} key - Cache key
   */
  releaseLock(key) {
    this.locks.delete(key);
  }

  /**
   * Get a value from cache
   *
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if not found/expired
   */
  get(key) {
    if (!this.acquireLock(key)) return null;

    try {
      const filename = this.getFilename(key);

      if (!fs.existsSync(filename)) return null;

      const data = JSON.parse(fs.readFileSync(filename, 'utf8'));

      // Check if expired
      if (Date.now() > data.expiresAt) {
        this.deleteFile(filename);
        return null;
      }

      return data.value;
    } catch (error) {
      console.error('FileCache get error:', error.message);
      return null;
    } finally {
      this.releaseLock(key);
    }
  }

  /**
   * Set a value in cache with atomic write
   *
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - TTL in ms (optional, uses default)
   */
  set(key, value, ttl = this.defaultTTL) {
    if (!this.acquireLock(key)) {
      console.error('FileCache set: Could not acquire lock for key:', key);
      return;
    }

    try {
      // Check max size and evict if needed
      this.evictIfNeeded();

      const filename = this.getFilename(key);
      const tempFile = `${filename}.tmp.${Date.now()}`;
      const data = {
        key,
        value,
        expiresAt: Date.now() + ttl,
        createdAt: Date.now(),
      };

      // Atomic write: write to temp file, then rename
      fs.writeFileSync(tempFile, JSON.stringify(data), 'utf8');
      fs.renameSync(tempFile, filename);
    } catch (error) {
      console.error('FileCache set error:', error.message);
    } finally {
      this.releaseLock(key);
    }
  }

  /**
   * Delete a cache file safely
   *
   * @param {string} filename - File path
   * @returns {boolean} True if deleted
   */
  deleteFile(filename) {
    try {
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Delete a value from cache
   *
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    if (!this.acquireLock(key)) return false;

    try {
      return this.deleteFile(this.getFilename(key));
    } finally {
      this.releaseLock(key);
    }
  }

  /**
   * Check if key exists and is not expired
   *
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    if (!this.acquireLock(key)) return false;

    try {
      const filename = this.getFilename(key);

      if (!fs.existsSync(filename)) return false;

      const data = JSON.parse(fs.readFileSync(filename, 'utf8'));

      if (Date.now() > data.expiresAt) {
        this.deleteFile(filename);
        return false;
      }

      return true;
    } catch {
      return false;
    } finally {
      this.releaseLock(key);
    }
  }

  /**
   * Clear all entries
   */
  clear() {
    try {
      const files = fs.readdirSync(this.directory);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          this.deleteFile(path.join(this.directory, file));
        }
      });
      this.locks.clear();
    } catch (error) {
      console.error('FileCache clear error:', error.message);
    }
  }

  /**
   * Evict oldest entries if at max size
   */
  evictIfNeeded() {
    try {
      const files = this.getCacheFiles();

      if (files.length < this.maxSize) return;

      // Sort by creation time (oldest first)
      const fileStats = files.map(file => {
        const filepath = path.join(this.directory, file);
        try {
          const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          return { file, createdAt: data.createdAt || 0, filepath };
        } catch (e) {
          return { file, createdAt: 0, filepath };
        }
      });

      fileStats.sort((a, b) => a.createdAt - b.createdAt);

      // Remove oldest 10% or at least 1 entry
      const toRemove = Math.max(1, Math.floor(files.length * 0.1));
      for (let i = 0; i < toRemove && i < fileStats.length; i++) {
        this.deleteFile(fileStats[i].filepath);
      }
    } catch (error) {
      console.error('FileCache evict error:', error.message);
    }
  }

  /**
   * Get list of cache files
   *
   * @returns {string[]} Array of filenames
   */
  getCacheFiles() {
    try {
      return fs.readdirSync(this.directory).filter(f => f.endsWith('.json'));
    } catch {
      return [];
    }
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache stats
   */
  stats() {
    try {
      const files = this.getCacheFiles();
      let validCount = 0;
      let expiredCount = 0;
      const now = Date.now();

      files.forEach(file => {
        try {
          const data = JSON.parse(
            fs.readFileSync(path.join(this.directory, file), 'utf8'),
          );
          if (now > data.expiresAt) {
            expiredCount++;
          } else {
            validCount++;
          }
        } catch (e) {
          expiredCount++;
        }
      });

      return {
        type: 'file',
        directory: this.directory,
        totalEntries: files.length,
        validEntries: validCount,
        expiredEntries: expiredCount,
        maxSize: this.maxSize,
        defaultTTL: this.defaultTTL,
        activeLocks: this.locks.size,
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
   * @returns {number} Number of entries removed
   */
  cleanup() {
    try {
      const files = this.getCacheFiles();
      const now = Date.now();
      let removed = 0;

      files.forEach(file => {
        const filepath = path.join(this.directory, file);
        try {
          const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

          if (now > data.expiresAt) {
            this.deleteFile(filepath);
            removed++;
          }
        } catch {
          // Remove corrupted files
          this.deleteFile(filepath);
          removed++;
        }
      });

      // Clean up stale locks (older than 30 seconds)
      const lockTimeout = 30000;
      this.locks.forEach((timestamp, key) => {
        if (now - timestamp > lockTimeout) {
          this.locks.delete(key);
        }
      });

      return removed;
    } catch (error) {
      console.error('FileCache cleanup error:', error.message);
      return 0;
    }
  }

  /**
   * Get all keys
   *
   * @returns {string[]} Array of keys
   */
  keys() {
    try {
      const files = this.getCacheFiles();
      const keys = [];

      files.forEach(file => {
        try {
          const data = JSON.parse(
            fs.readFileSync(path.join(this.directory, file), 'utf8'),
          );
          if (data.key) keys.push(data.key);
        } catch {
          // Skip corrupted files
        }
      });

      return keys;
    } catch {
      return [];
    }
  }

  /**
   * Get cache size
   *
   * @returns {number} Current number of entries
   */
  get size() {
    return this.getCacheFiles().length;
  }
}
