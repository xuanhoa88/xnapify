/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-disable no-underscore-dangle */

import fss from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

/**
 * Memory Search Adapter (File-backed)
 *
 * Provides a text search interface that keeps all search documents in memory
 * for fast lookups, while asynchronously persisting each document to a unique
 * file on disk ensuring durability.
 *
 * Features:
 * - On launch: loads all `.json` files into memory
 * - Concurrency control: queue-per-file mutex prevents race conditions
 * - Basic text-matching search with pagination support
 * - Atomic file writes via temp-file + rename
 */
export default class MemorySearch {
  /**
   * @param {Object} options
   * @param {string} [options.directory] - Directory to store document files. Defaults to `~/.rsk/fts`
   */
  constructor(options = {}) {
    this.directory =
      options.directory ||
      process.env.RSK_FTS_DIR ||
      path.join(os.homedir(), '.rsk', 'fts');
    this.memoryIndex = new Map(); // Key: `${entityType}_${entityId}` -> Value: Document
    this.isInitialized = false;
    this._initPromise = null;

    // Concurrency queues keyed by document ID to avoid race conditions.
    this.writeQueues = new Map();

    this._ensureDirectorySync();
    this._initPromise = this._loadFilesToMemory().catch(err => {
      console.error('Failed to initialize MemorySearch adapter files:', err);
    });
  }

  /**
   * Ensure cache directory exists synchronously at app launch.
   * @private
   */
  _ensureDirectorySync() {
    if (!fss.existsSync(this.directory)) {
      fss.mkdirSync(this.directory, { recursive: true });
    }
  }

  /**
   * Gets a queue promise for a specific key, chaining callbacks to prevent race conditions.
   * Each key has its own sequential queue so writes to different files run in parallel,
   * but writes to the same file run sequentially.
   *
   * @param {string} key
   * @param {Function} task - Async function to execute
   * @returns {Promise<any>}
   * @private
   */
  _enqueue(key, task) {
    const prevQueue = this.writeQueues.get(key) || Promise.resolve();

    // Chain the new task after the previous one completes (success or error),
    // but always run the new task fresh (don't re-run on previous errors).
    const newQueue = prevQueue
      .catch(() => {
        // Swallow previous task's error so the queue continues
      })
      .then(() => task());

    this.writeQueues.set(key, newQueue);

    return newQueue;
  }

  /**
   * Load all cached JSON files into memory.
   * @private
   */
  async _loadFilesToMemory() {
    try {
      const files = await fs.readdir(this.directory);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.directory, file);
            const data = await fs.readFile(filePath, 'utf8');
            const document = JSON.parse(data);
            const key = `${document.entityType}_${document.entityId}`;
            this.memoryIndex.set(key, document);
          } catch (err) {
            console.error(`Error loading search file ${file}:`, err);
          }
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    } finally {
      this.isInitialized = true;
    }
  }

  /**
   * Wait until memory load is complete.
   * Uses the stored init promise for deterministic waiting instead of polling.
   * @private
   */
  async _waitForInitialization() {
    if (this.isInitialized) return;
    await this._initPromise;
  }

  /**
   * Add or update a document in the search index.
   *
   * @param {import('../factory').SearchDocument} document - The document to index
   */
  async index(document) {
    await this._waitForInitialization();

    if (!document.entityType || document.entityId == null) {
      throw new Error('document requires entityType and entityId');
    }

    const key = `${document.entityType}_${document.entityId}`;

    // Update memory map immediately for next readers
    this.memoryIndex.set(key, document);

    const filePath = path.join(this.directory, `${key}.json`);

    // Use concurrency queue to write to file safely
    await this._enqueue(key, async () => {
      // Writing to temp file and renaming for atomic replace
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(document, null, 2), 'utf8');
      await fs.rename(tempPath, filePath);
    });
  }

  /**
   * Search for documents using basic text matching.
   *
   * @param {string} query - Text to search for
   * @param {Object} [options]
   * @param {number} [options.limit=20] - Maximum results
   * @param {number} [options.offset=0] - Result offset for pagination
   * @returns {Promise<Array<Object>>} Matching documents sorted by priority/popularity
   */
  async search(query, options = {}) {
    await this._waitForInitialization();

    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const normalizedQuery = (query || '').toLowerCase().trim();

    if (!normalizedQuery) {
      return [];
    }

    const results = [];

    // Simple textual match across memory
    for (const doc of this.memoryIndex.values()) {
      const titleMatch =
        doc.title && doc.title.toLowerCase().includes(normalizedQuery);
      const contentMatch =
        doc.content && doc.content.toLowerCase().includes(normalizedQuery);
      const tagsMatch =
        doc.tags && doc.tags.toLowerCase().includes(normalizedQuery);

      if (titleMatch || contentMatch || tagsMatch) {
        results.push({
          ...doc,
          snippet: doc.content ? doc.content.substring(0, 100) + '...' : '',
          fullContent: doc.content,
          rank: -((doc.priority || 0) * 10 + (doc.popularity || 0)),
        });
      }
    }

    // Ranking by priority/popularity
    results.sort((a, b) => {
      const rankA = (a.priority || 0) * 10 + (a.popularity || 0);
      const rankB = (b.priority || 0) * 10 + (b.popularity || 0);
      return rankB - rankA;
    });

    // Apply pagination
    return results.slice(offset, offset + limit);
  }

  /**
   * Remove a document from the search index.
   *
   * @param {string} entityType
   * @param {string|number} entityId
   * @returns {Promise<boolean>} True if a document was removed
   */
  async remove(entityType, entityId) {
    await this._waitForInitialization();

    const key = `${entityType}_${entityId}`;
    if (!this.memoryIndex.has(key)) {
      return false;
    }

    this.memoryIndex.delete(key);

    const filePath = path.join(this.directory, `${key}.json`);

    await this._enqueue(key, async () => {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    });

    return true;
  }

  /**
   * Clear documents from the search index.
   * If a prefix is provided, only documents matching the prefix are cleared.
   *
   * @param {string} [prefix] - Optional prefix to match entityType keys
   */
  async clear(prefix) {
    await this._waitForInitialization();
    let keys = Array.from(this.memoryIndex.keys());

    if (prefix) {
      keys = keys.filter(key => key.startsWith(prefix));
    }

    // Concurrently remove files securely
    await Promise.all(
      keys.map(key =>
        this._enqueue(key, async () => {
          this.memoryIndex.delete(key);
          const filePath = path.join(this.directory, `${key}.json`);
          try {
            await fs.unlink(filePath);
          } catch {
            // Ignore ENOENT
          }
        }),
      ),
    );
  }

  /**
   * Count documents in the index.
   * If a prefix is provided, only documents matching the prefix are counted.
   *
   * @param {string} [prefix] - Optional prefix to filter by namespace
   * @returns {Promise<number>} Number of matching documents
   */
  async count(prefix) {
    await this._waitForInitialization();
    if (!prefix) return this.memoryIndex.size;
    let n = 0;
    for (const key of this.memoryIndex.keys()) {
      if (key.startsWith(prefix)) n++;
    }
    return n;
  }
}
