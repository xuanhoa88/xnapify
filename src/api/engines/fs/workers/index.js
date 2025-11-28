/**
 * Filesystem Worker Service - Manages filesystem operations
 * Supports both same-process and child process execution
 *
 * Features:
 * - Dynamic worker discovery via require.context
 * - Hybrid execution: same-process first, fork fallback
 * - Worker pool management with automatic scaling
 * - Comprehensive error handling and recovery
 */

import { fork } from 'child_process';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Use require.context to dynamically import worker files
const workersContext = require.context('./', false, /\.worker\.js$/);

// Cache for imported worker modules
const workerModuleCache = new Map();

/**
 * Get available worker types from require.context
 * @returns {Array<string>} Array of available worker names
 */
function getAvailableWorkers() {
  return workersContext
    .keys()
    .map(key => {
      // Extract worker name from './name.worker.js' -> 'name'
      const match = key.match(/^\.\/(.+)\.worker\.js$/);
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

  if (!workersContext.keys().includes(workerKey)) {
    return null;
  }

  try {
    // Import the worker module directly
    const workerModule = workersContext(workerKey);
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
 * @throws {Error} If worker type is not found
 */
function getWorkerPath(workerName) {
  const workerKey = `./${workerName}.worker.js`;

  if (!workersContext.keys().includes(workerKey)) {
    const availableWorkers = getAvailableWorkers().join(', ');
    throw new Error(
      `Worker '${workerName}' not found. Available workers: ${availableWorkers}`,
    );
  }

  // Get the resolved path from webpack context
  const resolvedPath = workersContext.resolve(workerKey);
  return resolvedPath;
}

/**
 * Filesystem Worker Service
 * Manages both same-process and child process workers for filesystem operations
 */
class WorkerService {
  /**
   * Initialize the worker service
   * @param {Object} options - Configuration options
   * @param {number} options.maxWorkers - Maximum workers per type
   * @param {number} options.workerTimeout - Worker timeout in milliseconds
   * @param {number} options.maxRequestsPerWorker - Max requests per worker before restart
   */
  constructor(options = {}) {
    this.workers = new Map();
    this.pendingRequests = new Map();
    this.requestId = 0;

    // Configuration
    this.maxWorkers = options.maxWorkers || Math.min(os.cpus().length, 4);
    this.workerTimeout = options.workerTimeout || 60000; // 60 seconds
    this.maxRequestsPerWorker = options.maxRequestsPerWorker || 100;

    // Worker pools for each discovered type
    this.workerPools = getAvailableWorkers().reduce((pools, workerType) => {
      pools[workerType] = [];
      return pools;
    }, {});

    // Log discovered workers in development
    if (process.env.NODE_ENV !== 'production') {
      const workerNames = Object.keys(this.workerPools);
      console.log(
        `📁 Discovered ${workerNames.length} worker(s): ${workerNames.join(', ')}`,
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
      throw new Error(`Unknown worker type: ${workerType}`);
    }

    const pool = this.workerPools[workerType];

    // Try to find an available worker
    let worker = pool.find(
      w => w.available && w.requestCount < this.maxRequestsPerWorker,
    );

    if (!worker) {
      // Create new worker if pool is not full
      if (pool.length < this.maxWorkers) {
        worker = await this.createWorker(workerType);
        pool.push(worker);
      } else {
        // Wait for an available worker
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
      // Get worker file path using require.context
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

      // Handle worker messages
      worker.on('message', message => {
        if (message.type === 'WORKER_READY') {
          resolve(workerInstance);
        } else if (message.id) {
          this.handleWorkerResponse(message);
        }
      });

      // Handle worker errors
      worker.on('error', error => {
        console.error(`Worker ${workerInstance.id} error:`, error);
        this.removeWorker(workerInstance);
        reject(error);
      });

      // Handle worker exit
      worker.on('exit', (code, signal) => {
        console.log(
          `Worker ${workerInstance.id} exited with code ${code}, signal ${signal}`,
        );
        this.removeWorker(workerInstance);
      });

      // Set timeout for worker creation
      setTimeout(() => {
        if (!this.workerPools[workerType].includes(workerInstance)) {
          worker.kill();
          reject(new Error('Worker creation timeout'));
        }
      }, 10000);
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
   * Tries same-process execution first, falls back to fork if needed
   * @param {string} workerType - Type of worker (upload, download, etc.)
   * @param {string} messageType - Message type for the worker
   * @param {Object} data - Request data to process
   * @returns {Promise<Object>} Worker response { success, result?, error? }
   * @throws {Error} If worker request fails or times out
   */
  async sendRequest(workerType, messageType, data) {
    // Try same-process execution first (faster, no IPC overhead)
    const workerModule = tryImportWorkerModule(workerType);

    if (workerModule && typeof workerModule.default === 'function') {
      try {
        // Execute worker function directly in same process
        const result = await workerModule.default({
          id: ++this.requestId,
          type: messageType,
          data,
        });

        if (result && result.success != null) {
          return result;
        }
      } catch (error) {
        console.warn(
          `Same-process worker '${workerType}' failed, falling back to fork:`,
          error.message,
        );
      }
    }

    // Fallback to fork-based worker (slower but more robust)
    return this.sendRequestToForkedWorker(workerType, messageType, data);
  }

  /**
   * Send request to forked worker process (fallback implementation)
   * @param {string} workerType - Type of worker (upload, download, etc.)
   * @param {string} messageType - Message type for the worker
   * @param {Object} data - Request data to process
   * @returns {Promise<Object>} Worker response { success, result?, error? }
   */
  async sendRequestToForkedWorker(workerType, messageType, data) {
    const worker = await this.getWorker(workerType);
    const requestId = ++this.requestId;

    return new Promise((resolve, reject) => {
      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        worker,
        timestamp: Date.now(),
      });

      // Send message to worker
      worker.process.send({
        id: requestId,
        type: messageType,
        data,
      });

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          this.releaseWorker(worker);
          reject(
            new Error(`Worker request timeout: ${workerType}:${messageType}`),
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

    if (success) {
      pendingRequest.resolve(result);
    } else {
      const workerError = new Error(error.message);
      workerError.stack = error.stack;
      pendingRequest.reject(workerError);
    }
  }

  /**
   * Release worker back to available pool
   * @param {Object} worker - Worker instance
   */
  releaseWorker(worker) {
    worker.available = true;
    worker.lastUsed = Date.now();

    // Restart worker if it has handled too many requests
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

    // Clean up temporary worker file
    if (worker.process && worker.process.tempPath) {
      try {
        fs.unlinkSync(worker.process.tempPath);
      } catch (error) {
        console.warn('Failed to cleanup temporary worker file:', error.message);
      }
    }
  }

  /**
   * Create ZIP file using worker
   * @param {Array} fileInfos - Array of file information objects
   * @param {string} outputPath - Output file path
   * @param {Object} options - ZIP creation options
   * @returns {Promise<Object>} ZIP result
   */
  async createZipFile(fileInfos, outputPath, options = {}) {
    return await this.sendRequest('zip', 'ZIP_FILES', {
      type: 'CREATE_ZIP',
      fileInfos,
      outputPath,
      options,
    });
  }

  /**
   * Extract ZIP archive using worker
   * @param {string} zipSource - Path to ZIP file
   * @param {string} extractPath - Directory to extract files to
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Extraction result
   */
  async extractZip(zipSource, extractPath, options = {}) {
    return await this.sendRequest('zip', 'ZIP_FILES', {
      type: 'EXTRACT_ZIP',
      zipSource,
      extractPath,
      options,
    });
  }

  /**
   * Process upload operation
   * @param {Array} filesData - Files to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async processUpload(filesData, options = {}) {
    const type =
      Array.isArray(filesData) && filesData.length > 1
        ? 'UPLOAD_BATCH'
        : 'UPLOAD_SINGLE';
    return await this.sendRequest('upload', 'UPLOAD_FILES', {
      type,
      filesData,
      options,
    });
  }

  /**
   * Process download operation
   * @param {Array} fileNames - Files to download
   * @param {Object} options - Download options
   * @returns {Promise<Object>} Download result
   */
  async processDownload(fileNames, options = {}) {
    const type =
      Array.isArray(fileNames) && fileNames.length > 1
        ? 'DOWNLOAD_BATCH'
        : 'DOWNLOAD_SINGLE';
    return await this.sendRequest('download', 'DOWNLOAD_FILES', {
      type,
      fileNames,
      options,
    });
  }

  /**
   * Process delete operation
   * @param {Array} fileNames - Files to delete
   * @param {Object} options - Delete options
   * @returns {Promise<Object>} Delete result
   */
  async processDelete(fileNames, options = {}) {
    const type =
      Array.isArray(fileNames) && fileNames.length > 1
        ? 'DELETE_BATCH'
        : 'DELETE_SINGLE';
    return await this.sendRequest('delete', 'DELETE_FILES', {
      type,
      fileNames,
      options,
    });
  }

  /**
   * Process rename operation
   * @param {Array} operations - Rename operations
   * @param {Object} options - Rename options
   * @returns {Promise<Object>} Rename result
   */
  async processRename(operations, options = {}) {
    const type =
      Array.isArray(operations) && operations.length > 1
        ? 'RENAME_BATCH'
        : 'RENAME_SINGLE';
    return await this.sendRequest('rename', 'RENAME_FILES', {
      type,
      operations,
      options,
    });
  }

  /**
   * Process copy operation
   * @param {Array} operations - Copy operations
   * @param {Object} options - Copy options
   * @returns {Promise<Object>} Copy result
   */
  async processCopy(operations, options = {}) {
    const type =
      Array.isArray(operations) && operations.length > 1
        ? 'COPY_BATCH'
        : 'COPY_SINGLE';
    return await this.sendRequest('copy', 'COPY_FILES', {
      type,
      operations,
      options,
    });
  }

  /**
   * Process sync operation
   * @param {Array} operations - Sync operations
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync result
   */
  async processSync(operations, options = {}) {
    const type =
      Array.isArray(operations) && operations.length > 1
        ? 'SYNC_BATCH'
        : 'SYNC_SINGLE';
    return await this.sendRequest('sync', 'SYNC_FILES', {
      type,
      operations,
      options,
    });
  }

  /**
   * Process info operation
   * @param {string} fileName - File name
   * @param {Object} options - Info options
   * @returns {Promise<Object>} Info result
   */
  async processInfo(fileName, options = {}) {
    return await this.sendRequest('info', 'FILE_INFO', {
      type: 'GET_FILE_INFO',
      fileName,
      options,
    });
  }

  /**
   * Process preview operation
   * @param {string} fileName - File name
   * @param {Object} options - Preview options
   * @returns {Promise<Object>} Preview result
   */
  async processPreview(fileName, options = {}) {
    return await this.sendRequest('info', 'FILE_INFO', {
      type: 'PREVIEW_FILE',
      fileName,
      options,
    });
  }

  /**
   * Cleanup all workers and pending requests
   * Called automatically on process exit
   */
  async cleanup() {
    // Cancel pending requests
    for (const [id, request] of this.pendingRequests) {
      request.reject(new Error('Service shutting down'));
      this.pendingRequests.delete(id);
    }

    // Kill all workers
    for (const [type, pool] of Object.entries(this.workerPools)) {
      for (const worker of pool) {
        this.removeWorker(worker);
      }
      this.workerPools[type] = [];
    }
  }

  /**
   * Get comprehensive service statistics
   * @returns {Object} Service stats including worker counts and request metrics
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

// =============================================================================
// SERVICE INITIALIZATION
// =============================================================================

/**
 * Singleton worker service instance
 * Manages all filesystem operations with hybrid execution strategy
 */
const workerService = new WorkerService();

// =============================================================================
// PROCESS LIFECYCLE MANAGEMENT
// =============================================================================

// Cleanup on normal process exit
process.on('exit', () => {
  workerService.cleanup();
});

// Cleanup on SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  workerService.cleanup();
  process.exit(0);
});

// Cleanup on SIGTERM (termination signal)
process.on('SIGTERM', () => {
  workerService.cleanup();
  process.exit(0);
});

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Export the singleton worker service
 * Provides hybrid same-process + fork execution for filesystem operations
 */
export default workerService;
