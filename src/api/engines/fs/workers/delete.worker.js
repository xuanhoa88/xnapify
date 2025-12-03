/**
 * Delete Worker - Handles file delete operations
 * Supports both same-process and child process execution
 */

import { deleteFile, deleteFiles } from '../actions/delete';
import { setupForkMode, createWorker, FilesystemWorkerError } from '../utils';

/**
 * Process delete operations
 * @param {Object} data - Delete data
 * @returns {Promise<Object>} Delete result
 */
async function processDelete(data) {
  const { type, fileNames } = data;

  switch (type) {
    case 'DELETE_SINGLE':
      return await deleteFile(fileNames);

    case 'DELETE_BATCH':
      return await deleteFiles(fileNames);

    default:
      throw new FilesystemWorkerError(`Unknown delete type: ${type}`);
  }
}

// Create worker function using helper
const workerFunction = createWorker(processDelete, 'DELETE_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupForkMode(processDelete, 'DELETE_FILES', 'Delete');
