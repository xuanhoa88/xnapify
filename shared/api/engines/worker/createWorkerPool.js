/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Worker Service - Generic worker pool management
 *
 * Features:
 * - Dynamic worker discovery via require.context
 * - Hybrid execution: same-process first, fork fallback
 * - Worker pool management with automatic scaling
 * - Comprehensive error handling and recovery
 *
 * This is a base class that can be extended by specific engines (email, fs, etc.)
 */

import { fork } from 'child_process';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { createWebpackContextAdapter } from '@shared/utils/webpackContextAdapter';
import { WorkerError } from './errors';

/**
 * Default worker configuration
 */
const DEFAULT_WORKER_CONFIG = Object.freeze({
  maxWorkers: Math.min(os.cpus().length, 4),
  workerTimeout: 60_000, // 60 seconds
  maxRequestsPerWorker: 100,
  workerCreationTimeout: 10_000, // 10 seconds
  forceFork: false, // Force fork mode (skip same-process execution)
});

/**
 * Create a WorkerPool instance for a specific engine
 *
 * @param {Object} workersContext - webpack require.context for worker files
 * @param {Object} options - Configuration options
 * @param {class} options.ErrorHandler - Error class to use for worker errors
 * @param {string} options.engineName - Name of the engine (for logging)
 * @param {number} options.maxWorkers - Maximum workers per type
 * @param {number} options.workerTimeout - Worker timeout in milliseconds
 * @param {number} options.maxRequestsPerWorker - Max requests per worker before restart
 * @returns {WorkerPool} Worker service instance
 */
export function createWorkerPool(workersContext, options = {}) {
  // Wrap context with adapter for consistent interface
  const adapter = createWebpackContextAdapter(workersContext);

  const {
    ErrorHandler = WorkerError,
    engineName = 'Worker',
    maxWorkers = DEFAULT_WORKER_CONFIG.maxWorkers,
    workerTimeout = DEFAULT_WORKER_CONFIG.workerTimeout,
    maxRequestsPerWorker = DEFAULT_WORKER_CONFIG.maxRequestsPerWorker,
    workerCreationTimeout = DEFAULT_WORKER_CONFIG.workerCreationTimeout,
  } = options;

  // Cache for imported worker modules
  const workerModuleCache = new Map();

  /**
   * Get available worker types from context adapter
   * @returns {Array<string>} Array of available worker names
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
   * @param {string} workerName - Name of the worker
   * @returns {Object|null} Worker module or null if import fails
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
   * Get worker file path for fork() fallback
   * @param {string} workerName - Name of the worker
   * @returns {string} Absolute path to worker file
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

  /**
   * Worker Service Class
   */
  class WorkerPool {
    constructor() {
      this.workers = new Map();
      this.pendingRequests = new Map();
      this.requestId = 0;

      // Configuration
      this.maxWorkers = maxWorkers;
      this.workerTimeout = workerTimeout;
      this.maxRequestsPerWorker = maxRequestsPerWorker;
      this.workerCreationTimeout = workerCreationTimeout;

      // Worker pools for each discovered type
      this.workerPools = getAvailableWorkers().reduce((pools, workerType) => {
        pools[workerType] = [];
        return pools;
      }, {});

      // Log discovered workers in development
      if (process.env.NODE_ENV !== 'production') {
        const workerNames = Object.keys(this.workerPools);
        console.log(
          `${engineName} discovered ${workerNames.length} worker(s): ${workerNames.join(', ')}`,
        );
      }
    }

    /**
     * Get or create a worker for the specified type
     * @param {string} workerType - Type of worker needed
     * @returns {Promise<Object>} Worker instance
     */
    async getWorker(workerType) {
      if (!this.workerPools[workerType]) {
        throw new ErrorHandler(`Unknown worker type: ${workerType}`);
      }

      const pool = this.workerPools[workerType];

      let worker = pool.find(
        w => w.available && w.requestCount < this.maxRequestsPerWorker,
      );

      if (!worker) {
        if (pool.length < this.maxWorkers) {
          worker = await this.createWorker(workerType);
          pool.push(worker);
        } else {
          worker = await this.waitForAvailableWorker(workerType);
        }
      }

      worker.available = false;
      worker.requestCount++;
      worker.lastUsed = Date.now();

      return worker;
    }

    /**
     * Create a new worker process
     * @param {string} workerType - Type of worker to create
     * @returns {Promise<Object>} Worker instance
     */
    async createWorker(workerType) {
      return new Promise((resolve, reject) => {
        const workerPath = getWorkerPath(workerType);

        const worker = fork(workerPath, [], {
          silent: false,
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        });

        const workerInstance = {
          id: `${workerType}-${uuidv4()}`,
          type: workerType,
          process: worker,
          available: true,
          requestCount: 0,
          createdAt: Date.now(),
          lastUsed: Date.now(),
        };

        worker.on('message', message => {
          if (message.type === 'WORKER_READY') {
            resolve(workerInstance);
          } else if (message.id) {
            this.handleWorkerResponse(message);
          }
        });

        worker.on('error', error => {
          console.error(`Worker ${workerInstance.id} error:`, error);
          this.removeWorker(workerInstance);
          reject(error);
        });

        worker.on('exit', (code, signal) => {
          console.log(
            `Worker ${workerInstance.id} exited with code ${code}, signal ${signal}`,
          );
          this.removeWorker(workerInstance);
        });

        setTimeout(() => {
          if (!this.workerPools[workerType].includes(workerInstance)) {
            worker.kill();
            reject(
              new WorkerError(
                'Worker creation timeout',
                'WORKER_CREATION_TIMEOUT',
                500,
              ),
            );
          }
        }, this.workerCreationTimeout);
      });
    }

    /**
     * Wait for an available worker
     * @param {string} workerType - Type of worker needed
     * @returns {Promise<Object>} Available worker
     */
    async waitForAvailableWorker(workerType) {
      return new Promise(resolve => {
        const checkForWorker = () => {
          const pool = this.workerPools[workerType];
          const worker = pool.find(
            w => w.available && w.requestCount < this.maxRequestsPerWorker,
          );

          if (worker) {
            resolve(worker);
          } else {
            setTimeout(checkForWorker, 100);
          }
        };

        checkForWorker();
      });
    }

    /**
     * Send request to worker using hybrid execution strategy
     *
     * Always tries same-process execution first (instant, no overhead).
     * Falls back to forked worker only if same-process fails.
     * This prevents fork timeouts from blocking requests.
     *
     * @param {string} workerType - Type of worker
     * @param {string} messageType - Message type for the worker
     * @param {Object} data - Request data to process
     * @param {Object} requestOptions - Request-specific options
     * @param {boolean} requestOptions.forceFork - If true, skip same-process and use fork directly
     * @returns {Promise<Object>} Worker response
     */
    async sendRequest(workerType, messageType, data, requestOptions = {}) {
      let { throwOnError } = requestOptions;
      if (throwOnError === undefined && data && data.options) {
        throwOnError = data.options.throwOnError;
      }

      const forceForkOption = requestOptions.forceFork;
      const shouldForceFork = forceForkOption || options.forceFork || false;

      // Try same-process execution first (fast, no fork overhead)
      if (!shouldForceFork) {
        const workerModule = tryImportWorkerModule(workerType);

        if (workerModule && typeof workerModule.default === 'function') {
          try {
            const result = await workerModule.default({
              id: ++this.requestId,
              type: messageType,
              data,
            });

            if (result && result.success != null) {
              if (throwOnError && !result.success) {
                const message =
                  (result.error && result.error.message) ||
                  result.message ||
                  'Worker processing failed';
                const code =
                  (result.error && result.error.code) || 'WORKER_ERROR';
                const statusCode =
                  (result.error && result.error.statusCode) || 500;

                const err = new Error(message);
                err.code = code;
                err.statusCode = statusCode;
                throw err;
              }
              return result;
            }
          } catch (error) {
            console.warn(
              `Same-process worker '${workerType}' failed, falling back to fork:`,
              error.message,
            );
          }
        }
      }

      // Fork fallback (or forced fork) — with graceful degradation
      try {
        const result = await this.sendRequestToForkedWorker(
          workerType,
          messageType,
          data,
        );

        if (throwOnError && !result.success) {
          let message = 'Worker processing failed';
          if (result.error && result.error.message) {
            message = result.error.message;
          } else if (result.message) {
            message = result.message;
          }
          const code = (result.error && result.error.code) || 'WORKER_ERROR';
          const statusCode = (result.error && result.error.statusCode) || 500;

          const err = new Error(message);
          err.code = code;
          err.statusCode = statusCode;
          throw err;
        }

        return result;
      } catch (forkError) {
        // If fork was forced and failed, try same-process as last resort
        // UNLESS the error is explicitly that the worker is unknown/unregistered
        const isUnknownWorker =
          forkError.code === 'UNKNOWN_WORKER' ||
          (forkError.message &&
            forkError.message.includes('Unknown worker type'));

        if (shouldForceFork && !isUnknownWorker) {
          console.warn(
            `⚠️ Fork worker '${workerType}' failed (${forkError.code || forkError.message}), falling back to same-process`,
          );
          const workerModule = tryImportWorkerModule(workerType);

          if (workerModule && typeof workerModule.default === 'function') {
            const result = await workerModule.default({
              id: ++this.requestId,
              type: messageType,
              data,
            });

            if (result && result.success != null) {
              if (throwOnError && !result.success) {
                const message =
                  (result.error && result.error.message) ||
                  result.message ||
                  'Worker processing failed';
                const code =
                  (result.error && result.error.code) || 'WORKER_ERROR';
                const statusCode =
                  (result.error && result.error.statusCode) || 500;

                const err = new Error(message);
                err.code = code;
                err.statusCode = statusCode;
                throw err;
              }
              return result;
            }
          }
        }

        if (throwOnError) {
          throw forkError;
        }

        // Return standard failure format if it threw a hard error but throwOnError is false
        return {
          success: false,
          error: {
            message: forkError.message,
            code: forkError.code || 'WORKER_ERROR',
          },
        };
      }
    }

    /**
     * Send request to forked worker process
     * @param {string} workerType - Type of worker
     * @param {string} messageType - Message type for the worker
     * @param {Object} data - Request data to process
     * @returns {Promise<Object>} Worker response
     */
    async sendRequestToForkedWorker(workerType, messageType, data) {
      const worker = await this.getWorker(workerType);
      const requestId = ++this.requestId;

      return new Promise((resolve, reject) => {
        this.pendingRequests.set(requestId, {
          resolve,
          reject,
          worker,
          timestamp: Date.now(),
        });

        worker.process.send({
          id: requestId,
          type: messageType,
          data,
        });

        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            this.releaseWorker(worker);
            reject(
              new WorkerError(
                `Worker request timeout: ${workerType}:${messageType}`,
                'WORKER_REQUEST_TIMEOUT',
                500,
              ),
            );
          }
        }, this.workerTimeout);
      });
    }

    /**
     * Handle worker response
     * @param {Object} message - Worker response message
     */
    handleWorkerResponse(message) {
      const { id, success, result, error } = message;
      const pendingRequest = this.pendingRequests.get(id);

      if (!pendingRequest) {
        console.warn(`Received response for unknown request ID: ${id}`);
        return;
      }

      this.pendingRequests.delete(id);
      this.releaseWorker(pendingRequest.worker);

      // Always resolve with standard shape so sendRequest can apply throwOnError uniformly
      if (success) {
        pendingRequest.resolve({ success: true, id, result });
      } else {
        pendingRequest.resolve({
          success: false,
          id,
          error: {
            message: error.message,
            code: error.code,
            statusCode: error.status || error.statusCode || 500,
            stack: error.stack,
          },
        });
      }
    }

    /**
     * Release worker back to available pool
     * @param {Object} worker - Worker instance
     */
    releaseWorker(worker) {
      worker.available = true;
      worker.lastUsed = Date.now();

      if (worker.requestCount >= this.maxRequestsPerWorker) {
        this.restartWorker(worker);
      }
    }

    /**
     * Restart a worker
     * @param {Object} worker - Worker to restart
     */
    async restartWorker(worker) {
      try {
        this.removeWorker(worker);
        const newWorker = await this.createWorker(worker.type);
        this.workerPools[worker.type].push(newWorker);
      } catch (error) {
        console.error(`Failed to restart worker ${worker.id}:`, error);
      }
    }

    /**
     * Remove worker from pool
     * @param {Object} worker - Worker to remove
     */
    removeWorker(worker) {
      const pool = this.workerPools[worker.type];
      const index = pool.indexOf(worker);
      if (index > -1) {
        pool.splice(index, 1);
      }

      if (worker.process && !worker.process.killed) {
        worker.process.kill();
      }
    }

    /**
     * Unregister a worker type completely
     * Removes all workers of the specified type and clears the module cache
     * @param {string} workerType - Type of worker to unregister
     * @returns {boolean} True if worker type was unregistered
     */
    unregisterWorker(workerType) {
      if (!this.workerPools[workerType]) {
        return false;
      }

      // Cancel any pending requests for this worker type
      for (const [id, request] of this.pendingRequests) {
        if (request.worker && request.worker.type === workerType) {
          request.reject(
            new WorkerError(
              `Worker type '${workerType}' unregistered`,
              'WORKER_UNREGISTERED',
              500,
            ),
          );
          this.pendingRequests.delete(id);
        }
      }

      // Remove all workers of this type
      const pool = this.workerPools[workerType];
      for (const worker of [...pool]) {
        this.removeWorker(worker);
      }

      // Clear from worker pools
      delete this.workerPools[workerType];

      // Clear from module cache
      workerModuleCache.delete(workerType);

      if (process.env.NODE_ENV !== 'production') {
        console.log(`${engineName} unregistered worker type: ${workerType}`);
      }

      return true;
    }

    /**
     * Cleanup all workers
     */
    async cleanup() {
      console.info('🧹 Cleaning up worker pool...');
      for (const [id, request] of this.pendingRequests) {
        request.reject(
          new WorkerError(
            'Service shutting down',
            'SERVICE_SHUTTING_DOWN',
            500,
          ),
        );
        this.pendingRequests.delete(id);
      }

      for (const [type, pool] of Object.entries(this.workerPools)) {
        for (const workerInstance of pool) {
          this.removeWorker(workerInstance);
        }
        this.workerPools[type] = [];
      }
    }

    /**
     * Get service statistics
     * @returns {Object} Service stats
     */
    getStats() {
      const stats = {
        totalWorkers: 0,
        workersByType: {},
        pendingRequests: this.pendingRequests.size,
        totalRequests: this.requestId,
      };

      for (const [type, pool] of Object.entries(this.workerPools)) {
        stats.workersByType[type] = {
          total: pool.length,
          available: pool.filter(w => w.available).length,
          busy: pool.filter(w => !w.available).length,
        };
        stats.totalWorkers += pool.length;
      }

      return stats;
    }
  }

  // Create singleton instance
  const workerPool = new WorkerPool();
  workerPool.sendRequest = workerPool.sendRequest.bind(workerPool);

  // Register cleanup with global coordinator

  return workerPool;
}

// Default options
createWorkerPool.options = DEFAULT_WORKER_CONFIG;
