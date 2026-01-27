/**
 * Sync Worker - Handles file synchronization operations
 * Supports both same-process and child process execution
 */

import { createWorkerHandler, setupWorkerProcess } from '../../worker';
import { createFactory } from '../factory';
import { FilesystemWorkerError } from '../utils';

/**
 * Process sync operations
 * @param {Object} data - Sync data
 * @returns {Promise<Object>} Sync result
 */
async function processSync(data) {
  const { type, operations, options = {} } = data;
  const fs = createFactory(options);

  switch (type) {
    case 'SYNC_SINGLE': {
      // For single sync, operations is an array with one sync operation
      const singleOperation = Array.isArray(operations)
        ? operations[0]
        : operations;
      return await fs.sync(singleOperation, { ...options, useWorker: false });
    }

    case 'SYNC_BATCH':
      // For batch sync, operations is an array of sync operations
      return await fs.sync(operations, { ...options, useWorker: false });

    default:
      throw new FilesystemWorkerError(`Unknown sync type: ${type}`);
  }
}

// Create standardized worker function using helper
const workerFunction = createWorkerHandler(processSync, 'SYNC_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupWorkerProcess(processSync, 'SYNC_FILES', 'Sync');
