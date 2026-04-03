/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import Piscina from 'piscina';

import { WorkerError } from './errors';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = Object.freeze({
  minThreads: parseInt(process.env.XNAPIFY_WORKER_MIN_THREADS, 10) || 1,
  maxThreads:
    parseInt(process.env.XNAPIFY_WORKER_MAX_THREADS, 10) ||
    Math.max(1, os.cpus().length - 1),
  idleTimeout: parseInt(process.env.XNAPIFY_WORKER_IDLE_TIMEOUT, 10) || 30_000,
  taskTimeout: parseInt(process.env.XNAPIFY_WORKER_TASK_TIMEOUT, 10) || 30_000,
  maxQueueSize: parseInt(process.env.XNAPIFY_WORKER_QUEUE_MAX, 10) || 100,
});

// ---------------------------------------------------------------------------
// WorkerPoolManager — thin facade over piscina
// ---------------------------------------------------------------------------

export class WorkerPoolManager {
  /**
   * @param {Object} [config]
   * @param {number} [config.minThreads] - Minimum always-warm threads
   * @param {number} [config.maxThreads] - Maximum threads under load
   * @param {number} [config.idleTimeout] - Idle thread termination (ms)
   * @param {number} [config.taskTimeout] - Per-task timeout (ms)
   * @param {number} [config.maxQueueSize] - Max queued tasks
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Ensure minThreads <= maxThreads
    if (this.config.minThreads > this.config.maxThreads) {
      this.config.minThreads = this.config.maxThreads;
    }

    /** @type {Map<string, string>} workerName → absolutePath */
    this.manifest = new Map();

    /** @type {Map<string, Set<AbortController>>} workerName → active controllers */
    this.activeTasks = new Map();

    /** @type {boolean} */
    this.terminated = false;

    /**
     * Shared piscina thread pool.
     * Uses per-task `filename` to route to the correct worker module.
     * @type {Piscina}
     */
    this.pool = new Piscina({
      minThreads: this.config.minThreads,
      maxThreads: this.config.maxThreads,
      idleTimeout: this.config.idleTimeout,
      maxQueue: this.config.maxQueueSize,
    });
  }

  // -------------------------------------------------------------------------
  // Manifest Management
  // -------------------------------------------------------------------------

  /**
   * Discover worker files by scanning a directory recursively.
   * Registers each `*.worker.js` file with:
   *   1. A **namespaced key** (relative path from baseDir, e.g., `extensions/my_plugin/math`)
   *   2. A **short alias** (basename only, e.g., `math`) — only when unique
   *
   * Callers can use either key:
   *   worker.run('math', ...)                       // short alias (unique)
   *   worker.run('extensions/my_plugin/math', ...)  // namespaced (disambiguation)
   *
   * @param {string} baseDir - Directory to scan (e.g., BUILD_DIR)
   */
  discoverWorkers(baseDir) {
    try {
      const workers = this.scanDir(baseDir, baseDir);

      // Track short names to detect collisions
      const shortNameCounts = new Map();
      for (const [, , shortName] of workers) {
        shortNameCounts.set(
          shortName,
          (shortNameCounts.get(shortName) || 0) + 1,
        );
      }

      let registered = 0;
      for (const [nsKey, absPath, shortName] of workers) {
        // Always register the namespaced key (guaranteed unique by path)
        this.manifest.set(nsKey, absPath);
        registered++;

        // Register short alias only when basename is unique
        if (shortNameCounts.get(shortName) === 1) {
          this.manifest.set(shortName, absPath);
        } else if (__DEV__) {
          console.warn(
            `[WorkerPool] Short alias "${shortName}" has collisions — ` +
              `use namespaced key "${nsKey}" instead`,
          );
        }
      }

      if (__DEV__ && registered > 0) {
        console.info(
          `[WorkerPool] Discovered ${registered} worker(s) in ${baseDir}`,
        );
      }
    } catch (error) {
      // BUILD_DIR may not exist yet (first startup)
      if (error.code !== 'ENOENT') {
        console.warn(
          `[WorkerPool] Failed to discover workers in ${baseDir}:`,
          error.message,
        );
      }
    }
  }

  /**
   * Recursively scan a directory for *.worker.js files.
   * @param {string} dir - Current directory being scanned
   * @param {string} baseDir - Root scan directory (for computing relative paths)
   * @returns {Array<[string, string, string]>} [namespacedKey, absolutePath, shortName]
   * @private
   */
  scanDir(dir, baseDir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.scanDir(fullPath, baseDir));
      } else if (/\.worker\.js$/i.test(entry.name)) {
        // Verify WORKER_POOL marker in compiled output.
        // BUILD_DIR files are webpack-compiled CJS — safe to require().
        // This ensures only Tier 2 (thread-safe, pure-data) workers are
        // registered, even if a non-pool worker ends up in BUILD_DIR.
        try {
          // Clear cache to ensure fresh read after recompilation
          delete require.cache[require.resolve(fullPath)];
          // eslint-disable-next-line import/no-dynamic-require, global-require
          const mod = require(fullPath);
          if (!mod.WORKER_POOL) continue;
        } catch {
          // Broken or non-CJS file — skip silently
          continue;
        }

        const shortName = path.basename(entry.name, '.worker.js');
        const relPath = path.relative(baseDir, fullPath);
        // Strip `.worker.js`, normalize separators, and remove structural
        // `workers/` segments (convention folder, not a meaningful namespace).
        const nsKey = relPath
          .replace(/\.worker\.js$/i, '')
          .replace(/\\/g, '/')
          .replace(/(^|\/)workers\//g, '$1');
        results.push([nsKey, fullPath, shortName]);
      }
    }

    return results;
  }

  /**
   * Manually register a worker file path.
   * Used by extensions that load dynamically after startup.
   *
   * @param {string} name - Worker name (e.g., 'math')
   * @param {string} absolutePath - Absolute path to compiled CJS file
   */
  registerWorker(name, absolutePath) {
    if (!name || typeof name !== 'string') {
      throw new WorkerError(
        'Worker name must be a non-empty string',
        'INVALID_ARGUMENT',
        400,
      );
    }
    if (!absolutePath || typeof absolutePath !== 'string') {
      throw new WorkerError(
        'Worker path must be a non-empty string',
        'INVALID_ARGUMENT',
        400,
      );
    }
    if (!path.isAbsolute(absolutePath)) {
      throw new WorkerError(
        'Worker path must be an absolute path',
        'INVALID_PATH',
        400,
      );
    }
    this.manifest.set(name, absolutePath);
  }

  /**
   * Unregister a worker by name.
   *
   * Cancels all in-flight tasks for this worker (piscina terminates the
   * worker thread on abort), clears the require.cache entry, and removes
   * the worker from the manifest.
   *
   * @param {string} name - Worker name
   * @returns {boolean} True if the worker was found and removed
   */
  unregisterWorker(name) {
    // 1. Cancel all in-flight tasks for this worker
    const activeTasks = this.activeTasks.get(name);
    if (activeTasks) {
      for (const ac of activeTasks) ac.abort();
      this.activeTasks.delete(name);
    }

    // 2. Clear require.cache to free memory
    const workerPath = this.manifest.get(name);
    if (workerPath) {
      try {
        delete require.cache[require.resolve(workerPath)];
      } catch {
        // File may no longer exist — ignore
      }
    }

    // 3. Remove from manifest
    return this.manifest.delete(name);
  }

  /**
   * Check if a worker is registered.
   *
   * @param {string} name - Worker name
   * @returns {boolean}
   */
  hasWorker(name) {
    return this.manifest.has(name);
  }

  /**
   * Get all registered worker names.
   *
   * @returns {string[]}
   */
  getWorkerNames() {
    return Array.from(this.manifest.keys());
  }

  // -------------------------------------------------------------------------
  // Run
  // -------------------------------------------------------------------------

  /**
   * Run a worker function in a thread.
   *
   * Delegates to piscina with per-task `filename`, `name`, and `signal`.
   * Uses AbortController for both timeout and cancellation — when aborted,
   * piscina terminates the worker thread (no zombie tasks).
   *
   * @param {string} workerName - Registered worker name (e.g., 'math')
   * @param {string} fnName - Export function name (e.g., 'fibonacci')
   * @param {*} [data] - Serializable payload
   * @param {Object} [options]
   * @param {number} [options.timeout] - Override task timeout (ms)
   * @returns {Promise<*>} Worker function return value
   * @throws {WorkerError} On not found, timeout, cancellation, or pool terminated
   */
  async run(workerName, fnName, data, options = {}) {
    if (this.terminated) {
      throw new WorkerError(
        'Worker pool has been terminated',
        'POOL_TERMINATED',
        503,
      );
    }

    const workerPath = this.manifest.get(workerName);
    if (!workerPath) {
      throw new WorkerError(
        `Worker "${workerName}" not found. Registered workers: ${this.getWorkerNames().join(', ') || '(none)'}`,
        'WORKER_NOT_FOUND',
        404,
      );
    }

    const timeout = options.timeout || this.config.taskTimeout;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);

    // Track this task so unregisterWorker() can cancel it
    let tasks = this.activeTasks.get(workerName);
    if (!tasks) {
      tasks = new Set();
      this.activeTasks.set(workerName, tasks);
    }
    tasks.add(ac);

    try {
      const result = await this.pool.run(data, {
        filename: workerPath,
        name: fnName,
        signal: ac.signal,
      });
      return result;
    } catch (error) {
      if (error instanceof WorkerError) throw error;
      // AbortError from piscina means timeout or explicit cancellation
      if (error.name === 'AbortError') {
        throw new WorkerError(
          `Worker "${workerName}.${fnName}" timed out or was cancelled`,
          'WORKER_TIMEOUT',
          408,
        );
      }
      throw new WorkerError(
        error.message,
        error.code || 'WORKER_EXECUTION_ERROR',
        500,
      );
    } finally {
      clearTimeout(timer);
      tasks.delete(ac);
      if (tasks.size === 0) this.activeTasks.delete(workerName);
    }
  }

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  /**
   * Get pool statistics.
   *
   * @returns {Object} Pool stats
   */
  getStats() {
    const total = this.pool.threads.length;
    const active = Math.round(this.pool.utilization * total);
    const idle = total - active;

    return {
      threads: {
        total,
        idle,
        active,
        min: this.config.minThreads,
        max: this.config.maxThreads,
      },
      tasks: {
        completed: this.pool.completed,
        queued: this.pool.queueSize,
      },
      workers: this.getWorkerNames(),
    };
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /**
   * Gracefully shut down the pool.
   * Terminates all threads and rejects queued tasks.
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (this.terminated) return;
    this.terminated = true;

    console.info('🧹 Cleaning up worker pool...');

    // Cancel all in-flight tasks across all workers
    for (const [, tasks] of this.activeTasks) {
      for (const ac of tasks) ac.abort();
    }
    this.activeTasks.clear();

    try {
      await this.pool.destroy();
    } catch (error) {
      console.error('[WorkerPool] Cleanup error:', error.message);
    }

    console.info('✅ Worker pool cleanup complete');
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new WorkerPoolManager instance with signal handler registration.
 * Auto-discovers workers from the build directory.
 *
 * @param {Object} [config] - Pool configuration
 * @returns {WorkerPoolManager}
 */
export function createFactory(config) {
  const engine = new WorkerPoolManager(config);

  // Auto-discover workers from BUILD_DIR.
  // At runtime, __dirname = BUILD_DIR (server.js output directory).
  // Workers are compiled as *.worker.js files in subdirectories.
  const buildDir = process.env.BUILD_DIR || __dirname;
  engine.discoverWorkers(buildDir);

  process.once('SIGTERM', () => engine.cleanup());
  process.once('SIGINT', () => engine.cleanup());

  return engine;
}
