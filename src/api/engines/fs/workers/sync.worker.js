/**
 * Sync Worker - Handles file synchronization operations
 * Supports both same-process and child process execution
 */

import { synchronizeFiles, synchronizeFile } from '../actions/sync';
import { setupForkMode, createWorker, FilesystemWorkerError } from '../utils';

/**
 * Process sync operations
 * @param {Object} data - Sync data
 * @returns {Promise<Object>} Sync result
 */
async function processSync(data) {
  const { type, operations, options } = data;

  switch (type) {
    case 'SYNC_SINGLE': {
      // For single sync, operations is an array with one sync operation
      const singleOperation = Array.isArray(operations)
        ? operations[0]
        : operations;
      return await synchronizeFile(singleOperation, options);
    }

    case 'SYNC_BATCH':
      // For batch sync, operations is an array of sync operations
      return await synchronizeFiles(operations, options);

    default:
      throw new FilesystemWorkerError(`Unknown sync type: ${type}`);
  }
}

// Create standardized worker function using helper
const workerFunction = createWorker(processSync, 'SYNC_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupForkMode(processSync, 'SYNC_FILES', 'Sync');
