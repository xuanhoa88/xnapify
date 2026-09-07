/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  ensureDir,
  mapLimit,
  readJsonSafe,
  writeFileAtomic,
} from '@shared/utils/atomic/index.js';
import { getCacheDir } from '@shared/utils/env.js';

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
/**
 * Log the failures in a settled `mapLimit` batch, and say how many there were.
 *
 * `mapLimit` never rejects — it settles every task and hands back one result
 * object per item — so `await mapLimit(...)` inside a try/catch throws nothing
 * and the catch never runs. Housekeeping should carry on past a failed unlink,
 * but carrying on *silently* is how a cache that can no longer delete anything
 * reports success on clear() and re-runs the same doomed eviction on every
 * set(), growing past maxSize forever with nothing to show for it.
 *
 * @param {string} label - Operation name, for the log line.
 * @param {Array<{status: string, reason?: Error}>} results - From mapLimit.
 * @returns {number} How many tasks failed.
 */
function reportFailures(label, results) {
  const failed = results.filter(result => result.status === 'rejected');
  if (failed.length === 0) return 0;
  console.error(
    `[Cache:file] ${label}: ${failed.length} of ${results.length} failed ` +
      `(first: ${failed[0].reason && failed[0].reason.message})`,
  );
  return failed.length;
}

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
    this.directory = options.directory
      ? path.resolve(options.directory)
      : process.env.XNAPIFY_CACHE_DIR
        ? path.resolve(process.env.XNAPIFY_CACHE_DIR)
        : getCacheDir('caches');
    this.maxSize = options.maxSize || 10_000;
    this.defaultTTL = options.ttl || 5 * 60 * 1000; // 5 minutes

    // Async mutex: maps key → Promise chain
    this.lockQueues = new Map();

    // Track pending initialization.
    //
    // The rejection must be neutralised here, not left for whichever caller
    // happens to await `ready` first: a promise that rejects with no handler
    // attached in the same tick is an unhandled rejection, which on Node 20
    // terminates the process — so an unwritable cache directory would take the
    // whole server down at boot rather than degrading to "cache disabled".
    this.evicting = null;
    this.initError = null;
    this.ready = this.ensureDirectory().catch(error => {
      this.initError = error;
      console.error(
        `[Cache:file] Cache directory ${this.directory} is unusable; ` +
          `cache operations will no-op: ${error.message}`,
      );
    });
  }

  // ====================================================================
  // Directory & File Helpers
  // ====================================================================

  /**
   * Ensure cache directory exists
   * @returns {Promise<void>}
   */
  async ensureDirectory() {
    // `recursive: true` is already idempotent, so the access() probe it
    // replaced only added a window in which another worker could create the
    // directory between the check and the mkdir.
    await ensureDir(this.directory);
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
    // A cache is the one store where discarding an unreadable entry is the
    // right call — the value is reconstructible by definition — so corruption
    // degrades to a miss rather than an error. Everything that is *not*
    // "absent or unparseable" still propagates: an EACCES swallowed here would
    // turn a misconfigured deployment into a permanent, silent 0% hit rate.
    return readJsonSafe(filename, { fallback: null, onCorrupt: 'fallback' });
  }

  /**
   * Atomically write a cache file (temp + rename)
   *
   * @param {string} filename - Target file path
   * @param {Object} data - Data to write
   * @returns {Promise<void>}
   */
  async writeFile(filename, data) {
    // `durable: false` on purpose: a cache entry lost to a power cut is a miss,
    // and paying two fsyncs per write would dominate the cost of the very
    // lookups this exists to avoid. The temp file, its unique name and its
    // cleanup are not optional — those defend against a concurrent reader or
    // writer, which is a per-request event rather than a per-outage one.
    await writeFileAtomic(filename, JSON.stringify(data), {
      durable: false,
      ensureDir: false,
    });
  }

  /**
   * Delete a cache file safely
   *
   * @param {string} filename - File path
   * @returns {Promise<boolean>} True if deleted
   */
  /**
   * Identify the inode currently behind `filename`, or null when absent.
   *
   * A path is not an identity: this adapter publishes entries with rename, so
   * the same path can point at a different file moments later.
   * @private
   */
  async fileIdentity(filename) {
    try {
      const stat = await fs.promises.stat(filename);
      return `${stat.dev}:${stat.ino}`;
    } catch {
      return null;
    }
  }

  /**
   * Unlink `filename` only while it still refers to `identity`.
   * @private
   */
  async deleteFileIfUnchanged(filename, identity) {
    if (identity === null) return false;
    if ((await this.fileIdentity(filename)) !== identity) return false;
    return this.deleteFile(filename);
  }

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
      const identity = await this.fileIdentity(filename);
      const data = await this.readFile(filename);
      if (!data) return null;

      // Check if expired
      if (Date.now() > data.expiresAt) {
        // Delete by identity, not by path. Entries are published with rename,
        // so between reading this one and unlinking it another writer can have
        // put a *fresh* entry at the same path — and a path-based unlink would
        // throw that new entry away, turning an expiry into a lost write that
        // repeats for as long as the key stays hot.
        await this.deleteFileIfUnchanged(filename, identity);
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
    // Eviction is a property of the whole directory, not of this key, so it
    // runs outside the per-key lock. Holding that lock across a full-directory
    // sweep queued every other operation on the same key behind it.
    await this.evictIfNeeded();

    return this.withLock(key, async () => {
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
      // Same reason get() captures identity before reading: entries are
      // published by rename, so a fresh entry can land at this path between
      // the read and the unlink, and deleting by path alone would throw that
      // write away rather than the expired entry this read saw.
      const identity = await this.fileIdentity(filename);
      const data = await this.readFile(filename);
      if (!data) return false;

      if (Date.now() > data.expiresAt) {
        await this.deleteFileIfUnchanged(filename, identity);
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
      // Bounded fan-out: a cache that has grown to `maxSize` entries would
      // otherwise open ten thousand descriptors at once and hit EMFILE, which
      // surfaces as unrelated open() failures across the whole process.
      reportFailures(
        'clear',
        await mapLimit(files, file =>
          this.deleteFile(path.join(this.directory, file)),
        ),
      );
      // `lockQueues` is deliberately left alone. Clearing it does not cancel
      // the operations already chained on those promises — it just makes the
      // next caller for the same key build a fresh chain, so two writers to one
      // key run concurrently and the mutex silently stops holding.
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
    // Guarded so only one eviction sweep runs at a time. Without it, every
    // concurrent set() past the threshold starts its own full-directory pass.
    if (this.evicting) return this.evicting;

    this.evicting = (async () => {
      try {
        const files = await this.getCacheFiles();
        if (files.length < this.maxSize) return;

        // Order by mtime rather than by the `createdAt` stored inside each
        // entry. Reading and JSON-parsing every file to sort them meant 10,000
        // whole-file reads (each as large as whatever the caller cached) before
        // a single byte could be written — turning one set() into an O(n)
        // stall. Entries are published by rename, so mtime is the moment the
        // entry became visible: the same ordering, from a stat.
        const stats = await mapLimit(files, async file => {
          const filepath = path.join(this.directory, file);
          const stat = await fs.promises.stat(filepath);
          return { filepath, mtimeMs: stat.mtimeMs };
        });

        const entries = stats
          .filter(r => r.status === 'fulfilled')
          .map(r => r.value)
          .sort((a, b) => a.mtimeMs - b.mtimeMs);

        const toRemove = Math.max(
          1,
          Math.floor(files.length * EVICTION_PERCENT),
        );
        reportFailures(
          'evict',
          await mapLimit(entries.slice(0, toRemove), entry =>
            this.deleteFile(entry.filepath),
          ),
        );
      } catch (error) {
        console.error('[Cache:file] Evict error:', error.message);
      } finally {
        this.evicting = null;
      }
    })();

    return this.evicting;
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
        // cleanup() is the registered shutdown hook, so it runs while
        // in-flight set() calls are still draining in this very process —
        // it races live writers without needing a second one. Identity is
        // captured before the read for the same reason get() and has() do it.
        const identity = await this.fileIdentity(filepath);
        const data = await this.readFile(filepath);

        if (!data || now > data.expiresAt) {
          // Corrupt or expired: either way, only remove the entry this pass
          // actually looked at, never whatever has since replaced it.
          if (await this.deleteFileIfUnchanged(filepath, identity)) removed++;
        }
      }

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
