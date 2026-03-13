/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * Worker Service - Piscina Thread Pool implementation
 *
 * Features:
 * - Dynamic worker discovery via require.context
 * - Hybrid execution: same-process first, piscina background threads fallback
 * - Worker pool management with automatic scaling
 * - Comprehensive error handling and recovery
 */

import os from 'os';

import { createWebpackContextAdapter } from '@shared/utils/webpackContextAdapter';

import { WorkerError } from './errors';

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
    // Use __non_webpack_require__ if available (for Webpack environments)
    const moduleRequire =
      typeof __non_webpack_require__ === 'function'
        ? // eslint-disable-next-line no-undef
          __non_webpack_require__
        : require;
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
 * Create a WorkerPool instance for a specific engine using Piscina
 *
 * @param {string} engineName - Name of the engine (e.g. Email, Filesystem)
 * @param {Object} workersContext - webpack require.context for worker files
 * @param {Object} options - Configuration options
 * @returns {WorkerPool} Worker service instance
 */
export function createWorkerPool(engineName, workersContext, options = {}) {
  if (!engineName || typeof engineName !== 'string') {
    throw new Error(
      'createWorkerPool requires an engineName string as its first argument',
    );
  }

  const adapter = createWebpackContextAdapter(workersContext);

  const {
    ErrorHandler = WorkerError,
    maxWorkers = DEFAULT_WORKER_CONFIG.maxWorkers,
    workerTimeout = DEFAULT_WORKER_CONFIG.workerTimeout,
  } = options;

  // Cache for imported worker modules for same-process execution
  const workerModuleCache = new Map();

  /**
   * Get available worker types from context adapter
   */
  function getAvailableWorkers() {
    return adapter
      .files()
      .map(key => {
        const match = key.match(/^\.\/(.+)\.worker\.[cm]?[jt]s$/i);
        return match ? match[1] : null;
      })
      .filter(Boolean);
  }

  /**
   * Try to import worker module for same-process execution
   */
  function tryImportWorkerModule(workerName) {
    if (workerModuleCache.has(workerName)) {
      return workerModuleCache.get(workerName);
    }

    const workerKey = `./${workerName}.worker.js`;

    if (!adapter.files().includes(workerKey)) {
      return null;
    }

    try {
      const workerModule = adapter.load(workerKey);
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
   * Get worker file absolute path for Piscina
   */
  function getWorkerPath(workerName) {
    const workerKey = `./${workerName}.worker.js`;

    if (!adapter.files().includes(workerKey)) {
      const availableWorkers = getAvailableWorkers().join(', ');
      throw new ErrorHandler(
        `Worker '${workerName}' not found. Available workers: ${availableWorkers}`,
      );
    }

    return adapter.resolve(workerKey);
  }

  class WorkerPool {
    constructor() {
      // Configuration
      this.maxWorkers = maxWorkers;
      this.workerTimeout = workerTimeout;
      this.forceFork = options.forceFork || DEFAULT_WORKER_CONFIG.forceFork;
      this.engineName = engineName;
      this.ErrorHandler = ErrorHandler;

      this.knownWorkers = getAvailableWorkers();
      this.piscinaPoolInstance = null;

      // Log discovered workers in development
      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `${this.engineName} discovered ${this.knownWorkers.length} worker(s): ${this.knownWorkers.join(', ')}`,
        );
      }
    }

    /**
     * Get or initialize legal piscina pool
     * @private
     */
    get pool() {
      if (this.piscinaPoolInstance) return this.piscinaPoolInstance;

      try {
        const LoadedPiscina = loadPiscina();
        this.piscinaPoolInstance = new LoadedPiscina({
          maxThreads: this.maxWorkers,
          workerCreationTimeout: DEFAULT_WORKER_CONFIG.workerCreationTimeout,
        });
        return this.piscinaPoolInstance;
      } catch (error) {
        // If we fail to load Piscina (e.g. wrong node version),
        // we'll just return null and the run() method will handle it
        // by throwing an error if forceFork is requested.
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
      if (!shouldForceFork) {
        const workerModule = tryImportWorkerModule(workerType);

        if (workerModule && typeof workerModule[messageType] === 'function') {
          try {
            // Unpack promise directly. The worker returns standard results.
            const result = await workerModule[messageType](data);

            // Same-process usually returns direct domain payloads.
            // We'll wrap it to standardize with what old engines expected.
            return {
              success: true,
              result,
            };
          } catch (error) {
            console.warn(
              `Same-process worker '${workerType}' failed, falling back to thread:`,
              error.message,
            );
            // If it threw an error and strict throwOnError was requested
            if (throwOnError && !shouldForceFork) {
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
            stack: forkError.stack,
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

      // Create an abort controller to handle custom timeouts
      const abortController = new AbortController();
      const timeoutToken = setTimeout(() => {
        abortController.abort();
      }, this.workerTimeout);

      // 2. Offload to background thread via Piscina
      try {
        const { pool } = this;
        if (!pool) {
          throw new WorkerError(
            `Worker threads (Piscina) are not available in this environment (Node ${process.version}).`,
            'UNSUPPORTED_NODE_VERSION',
            500,
          );
        }
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

      if (process.env.NODE_ENV !== 'production') {
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
        console.info('Sweep cleaning up worker pool threads...');
        await this.piscinaPoolInstance.destroy();
        this.piscinaPoolInstance = null;
      }
    }

    /**
     * Get service statistics
     */
    getStats() {
      if (!this.piscinaPoolInstance) {
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
        totalWorkers: this.pool.threads.length,
        utilization: this.pool.utilization,
        completedTasks: this.pool.completed,
        runTimeInfo: this.pool.runTime,
      };
    }
  }

  // Create singleton instance
  const workerPool = new WorkerPool();
  workerPool.sendRequest = workerPool.sendRequest.bind(workerPool);

  return workerPool;
}

// Default options
createWorkerPool.options = DEFAULT_WORKER_CONFIG;
