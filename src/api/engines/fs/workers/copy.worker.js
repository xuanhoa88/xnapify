/**
 * Copy Worker - Handles file copy operations
 * Supports both same-process and child process execution
 */

import { createWorker, setupForkMode } from '../../worker';
import { copyFile, copyFiles } from '../actions/copy';
import { FilesystemWorkerError } from '../utils';

/**
 * Process copy operations
 * @param {Object} data - Copy data
 * @returns {Promise<Object>} Copy result
 */
async function processCopy(data) {
  const { type, operations, options } = data;

  switch (type) {
    case 'COPY_SINGLE': {
      const { sourceFileName, targetFileName, options } = operations;
      return await copyFile(sourceFileName, targetFileName, options);
    }

    case 'COPY_BATCH':
      return await copyFiles(operations, options);

    default:
      throw new FilesystemWorkerError(`Unknown copy type: ${type}`);
  }
}

// Create worker function using helper
const workerFunction = createWorker(processCopy, 'COPY_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupForkMode(processCopy, 'COPY_FILES', 'Copy');
