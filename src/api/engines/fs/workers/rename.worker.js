/**
 * Rename Worker - Handles file rename operations
 * Supports both same-process and child process execution
 */

import { createWorkerHandler, setupWorkerProcess } from '../../worker';
import { createFactory } from '../factory';
import { FilesystemWorkerError } from '../utils';

/**
 * Process rename operations
 * @param {Object} data - Rename data
 * @returns {Promise<Object>} Rename result
 */
async function processRename(data) {
  const { type, operations, options = {} } = data;
  const fs = createFactory(options);

  switch (type) {
    case 'RENAME_SINGLE': {
      const { oldName, newName, options: singleOptions } = operations;
      return await fs.rename({ oldName, newName }, singleOptions || options);
    }

    case 'RENAME_BATCH':
      return await fs.rename(operations.renameOperations, operations.options);

    default:
      throw new FilesystemWorkerError(`Unknown rename type: ${type}`);
  }
}

// Create worker function using helper
const workerFunction = createWorkerHandler(processRename, 'RENAME_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupWorkerProcess(processRename, 'RENAME_FILES', 'Rename');
