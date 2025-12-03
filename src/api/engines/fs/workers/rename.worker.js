/**
 * Rename Worker - Handles file rename operations
 * Supports both same-process and child process execution
 */

import { renameFile, renameFiles } from '../actions/rename';
import { setupForkMode, createWorker, FilesystemWorkerError } from '../utils';

/**
 * Process rename operations
 * @param {Object} data - Rename data
 * @returns {Promise<Object>} Rename result
 */
async function processRename(data) {
  const { type, operations } = data;

  switch (type) {
    case 'RENAME_SINGLE': {
      const { oldName, newName, options } = operations;
      return await renameFile(oldName, newName, options);
    }

    case 'RENAME_BATCH':
      return await renameFiles(operations.renameOperations, operations.options);

    default:
      throw new FilesystemWorkerError(`Unknown rename type: ${type}`);
  }
}

// Create worker function using helper
const workerFunction = createWorker(processRename, 'RENAME_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupForkMode(processRename, 'RENAME_FILES', 'Rename');
