/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * Worker Service - Piscina Thread Pool implementation
 *
 * Features:
 * - Dynamic worker discovery from pre-compiled standalone CJS files
 * - Hybrid execution: same-process first, piscina background threads fallback
 * - Worker pool management with automatic scaling
 * - Comprehensive error handling and recovery
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { createNativeRequire } from '@shared/utils/createNativeRequire';

import { WorkerError } from './errors';

// Use native require to load Piscina
const moduleRequire = createNativeRequire(__filename);

/**
 * Checks if the current Node.js environment supports Piscina.
 * Piscina require Node.js >= 16.14.0 (for EventEmitterAsyncResource).
 *
 * @returns {boolean} True if Piscina can be loaded
 */
function isPiscinaSupported() {
  const version = process.versions.node.split('.').map(Number);
  // Node >= 16.14.0
  return version[0] > 16 || (version[0] === 16 && version[1] >= 14);
}

/**
 * Lazy loader for Piscina
 * Prevents engine initialization crash on Node < 16.14.0
 */
let Piscina = null;
function loadPiscina() {
  if (Piscina) return Piscina;

  if (!isPiscinaSupported()) {
    throw new WorkerError(
      `Worker threads (Piscina) require Node.js >= 16.14.0. Current version is ${process.version}.`,
      'UNSUPPORTED_NODE_VERSION',
      500,
    );
  }

  try {
    // We use eval('require') to completely hide this call from Webpack's
    // static analysis. This ensures the dependency is NOT bundled and
    // is only resolved at runtime if this function is actually executed.
    Piscina = moduleRequire('piscina');
    return Piscina;
  } catch (error) {
    throw new WorkerError(
      `Failed to load Piscina: ${error.message}`,
      'INITIALIZATION_ERROR',
      500,
    );
  }
}

/**
 * Default worker configuration
 */
const DEFAULT_WORKER_CONFIG = Object.freeze({
  maxWorkers: Math.min(os.cpus().length, 4),
  workerTimeout: 60_000, // 60 seconds
  workerCreationTimeout: 10_000,
  forceFork: false, // Force thread mode (skip same-process execution)
});

/**
 * Pool registry — keyed by engineName.
 * Ensures each named pool is created only once (singleton per name).
 */
const poolRegistry = new Map();

/**
 * Create a WorkerPool instance for a specific engine using Piscina
 *
 * @param {string} engineName - Name of the engine (e.g. Email, Filesystem)
 * @param {Object} options - Configuration options
 * @returns {WorkerPool} Worker service instance
 */
export function createWorkerPool(engineName, options = {}) {
  if (!engineName || typeof engineName !== 'string') {
    throw new WorkerError(
      'createWorkerPool requires an engineName string as its first argument',
      'INVALID_ARGUMENT',
      400,
    );
  }

  // Return cached pool if one already exists for this engineName
  if (poolRegistry.has(engineName)) {
    if (__DEV__) {
      console.warn(
        `createWorkerPool: pool "${engineName}" already exists — returning cached instance.`,
      );
    }
    return poolRegistry.get(engineName);
  }

  // Resolve the workers directory relative to the bundle (__filename).
  // Standalone CJS files are emitted at:
  //   <bundleDir>/workers/<name>.worker.js  (extensions)
  //   <buildDir>/workers/<appName>/<name>.worker.js  (core apps)
  const bundleDir = path.dirname(__filename);
  const workersDir = path.join(bundleDir, 'workers');

  const {
    ErrorHandler = WorkerError,
    maxWorkers = DEFAULT_WORKER_CONFIG.maxWorkers,
    workerTimeout = DEFAULT_WORKER_CONFIG.workerTimeout,
    forceFork = DEFAULT_WORKER_CONFIG.forceFork,
  } = options;

  // Discover available workers from the filesystem (recursive)
  const workerPathMap = new Map(); // workerName → absolute path
  try {
    const files = fs.readdirSync(workersDir, {
      withFileTypes: true,
      recursive: true,
    });
    for (const file of files) {
      if (!file.isFile()) continue;
      const match = file.name.match(/^(.+)\.worker\.[cm]?[jt]s$/i);
      if (match) {
        // Dirent.parentPath (Node 21+) / Dirent.path (Node 20+)
        const fileDir = file.parentPath || file.path || workersDir;
        workerPathMap.set(match[1], path.join(fileDir, file.name));
      }
    }
  } catch {
    // Workers directory doesn't exist — pool has no workers
  }

  // Cache for imported worker modules for same-process execution
  const workerModuleCache = new Map();

  /**
   * Get available worker type names
   */
  function getAvailableWorkers() {
    return Array.from(workerPathMap.keys());
  }

  /**
   * Try to import worker module for same-process execution.
   * Uses native require() on the standalone CJS file.
   */
  function tryImportWorkerModule(workerName) {
    if (workerModuleCache.has(workerName)) {
      return workerModuleCache.get(workerName);
    }

    const workerPath = workerPathMap.get(workerName);
    if (!workerPath) return null;

    try {
      const workerModule = moduleRequire(workerPath);
      workerModuleCache.set(workerName, workerModule);
      return workerModule;
    } catch (error) {
      console.warn(
        `Failed to import worker module '${workerName}':`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Get worker file absolute path for Piscina's forceFork mode.
   * Returns the pre-compiled standalone CJS file path directly.
   */
  function getWorkerPath(workerName) {
    const workerPath = workerPathMap.get(workerName);
    if (!workerPath) {
      const available = getAvailableWorkers().join(', ');
      throw new ErrorHandler(
        `Worker '${workerName}' not found. Available workers: ${available}`,
      );
    }
    return workerPath;
  }

  class WorkerPool {
    constructor() {
      // Configuration
      this.maxWorkers = maxWorkers;
      this.workerTimeout = workerTimeout;
      this.forceFork = forceFork;
      this.engineName = engineName;
      this.ErrorHandler = ErrorHandler;

      this.knownWorkers = getAvailableWorkers();
      this.piscinaPoolInstance = null;
      this.piscinaLoadFailed = false;

      // Log discovered workers in development
      if (__DEV__) {
        console.log(
          `${this.engineName} discovered ${this.knownWorkers.length} worker(s): ${this.knownWorkers.join(', ')}`,
        );
      }
    }

    /**
     * Get or initialize lazy piscina pool
     * @private
     */
    get pool() {
      if (this.piscinaPoolInstance) return this.piscinaPoolInstance;
      if (this.piscinaLoadFailed) return null;

      try {
        const LoadedPiscina = loadPiscina();
        this.piscinaPoolInstance = new LoadedPiscina({
          maxThreads: this.maxWorkers,
          workerCreationTimeout: DEFAULT_WORKER_CONFIG.workerCreationTimeout,
        });
        return this.piscinaPoolInstance;
      } catch (error) {
        console.error(
          `${this.engineName}: Failed to initialize Piscina pool:`,
          error.message,
        );
        // Cache failure to prevent repeated initialization attempts
        this.piscinaLoadFailed = true;
        return null;
      }
    }

    /**
     * Send request using hybrid execution strategy (same-process first, then Piscina thread)
     */
    async sendRequest(workerType, messageType, data, requestOptions = {}) {
      let { throwOnError } = requestOptions;
      if (throwOnError === undefined && data && data.options) {
        throwOnError = data.options.throwOnError;
      }

      const forceForkOption = requestOptions.forceFork;
      const shouldForceFork = forceForkOption || this.forceFork;

      // Try same-process execution first (fast, no IPC overhead)
      if (!shouldForceFork && this.knownWorkers.includes(workerType)) {
        const workerModule = tryImportWorkerModule(workerType);

        if (workerModule && typeof workerModule[messageType] === 'function') {
          try {
            const result = await workerModule[messageType](data);

            return {
              success: true,
              result,
            };
          } catch (error) {
            console.warn(
              `Same-process worker '${workerType}' failed, falling back to thread:`,
              error.message,
            );
            if (throwOnError) {
              throw error;
            }
          }
        }
      }

      // Fallback to threaded (piscina) execution
      try {
        const result = await this.sendRequestToThread(
          workerType,
          messageType,
          data,
        );

        return {
          success: true,
          result,
        };
      } catch (forkError) {
        if (throwOnError) {
          throw forkError;
        }

        // Return standard failure format if it threw a hard error but throwOnError is false
        return {
          success: false,
          error: {
            message: forkError.message,
            code: forkError.code || 'WORKER_ERROR',
            statusCode: forkError.statusCode || 500,
            stack: __DEV__ ? forkError.stack : undefined,
          },
        };
      }
    }

    /**
     * Executes the task on a Piscina worker thread
     */
    async sendRequestToThread(workerType, messageType, data) {
      if (!this.knownWorkers.includes(workerType)) {
        throw new this.ErrorHandler(`Unknown worker type: ${workerType}`);
      }

      const workerPath = getWorkerPath(workerType);
      const { pool } = this;

      if (!pool) {
        throw new WorkerError(
          `Worker threads (Piscina) are not available in this environment (Node ${process.version}).`,
          'UNSUPPORTED_NODE_VERSION',
          500,
        );
      }

      const abortController = new AbortController();
      const timeoutToken = setTimeout(() => {
        abortController.abort();
      }, this.workerTimeout);

      try {
        const result = await pool.run(data, {
          filename: workerPath,
          name: messageType,
          signal: abortController.signal,
        });

        return result;
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new WorkerError(
            `Worker request timeout: ${workerType}:${messageType}`,
            'WORKER_REQUEST_TIMEOUT',
            500,
          );
        }
        throw error;
      } finally {
        clearTimeout(timeoutToken);
      }
    }

    /**
     * Unregister a worker type from the pool.
     * Clears the module cache so same-process fallback won't use it,
     * and removes it from the known workers list.
     *
     * @param {string} workerType - Type of worker to unregister
     * @returns {boolean} True if worker type was unregistered
     */
    unregisterWorker(workerType) {
      const index = this.knownWorkers.indexOf(workerType);
      if (index === -1) {
        return false;
      }

      this.knownWorkers.splice(index, 1);
      workerModuleCache.delete(workerType);
      workerPathMap.delete(workerType);

      if (__DEV__) {
        console.log(
          `${this.engineName} unregistered worker type: ${workerType}`,
        );
      }

      return true;
    }

    /**
     * Cleanup all workers
     */
    async cleanup() {
      if (this.piscinaPoolInstance) {
        console.info(`${this.engineName}: cleaning up worker pool threads...`);
        await this.piscinaPoolInstance.destroy();
        this.piscinaPoolInstance = null;
      }
      // Remove from registry so the engine name can be re-used
      poolRegistry.delete(this.engineName);
      workerModuleCache.clear();
    }

    /**
     * Get service statistics
     */
    getStats() {
      const pool = this.piscinaPoolInstance;
      if (!pool) {
        return {
          totalWorkers: 0,
          utilization: 0,
          completedTasks: 0,
          runTimeInfo: {
            idle: 0,
            running: 0,
            waiting: 0,
          },
        };
      }
      return {
        totalWorkers: pool.threads.length,
        utilization: pool.utilization,
        completedTasks: pool.completed,
        runTimeInfo: pool.runTime,
      };
    }
  }

  // Create singleton instance
  const workerPool = new WorkerPool();
  workerPool.sendRequest = workerPool.sendRequest.bind(workerPool);

  // Register in pool cache
  poolRegistry.set(engineName, workerPool);

  return workerPool;
}

// Default options
createWorkerPool.options = DEFAULT_WORKER_CONFIG;

// Expose registry for testing / inspection
createWorkerPool.registry = poolRegistry;
