/**
 * Copy Worker - Handles file copy operations
 * Supports both same-process and child process execution
 */

import { createWorkerHandler, setupWorkerProcess } from '../../worker';
import { createFactory } from '../factory';
import { FilesystemWorkerError } from '../utils';

/**
 * Process copy operations
 * @param {Object} data - Copy data
 * @returns {Promise<Object>} Copy result
 */
async function processCopy(data) {
  const { type, operations, options = {} } = data;
  const fs = createFactory(options);

  switch (type) {
    case 'COPY_SINGLE': {
      const {
        sourceFileName,
        targetFileName,
        options: singleOptions,
      } = operations;
      return await fs.copy(
        { source: sourceFileName, target: targetFileName },
        singleOptions || options,
      );
    }

    case 'COPY_BATCH':
      return await fs.copy(operations, options);

    default:
      throw new FilesystemWorkerError(`Unknown copy type: ${type}`);
  }
}

// Create worker function using helper
const workerFunction = createWorkerHandler(processCopy, 'COPY_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupWorkerProcess(processCopy, 'COPY_FILES', 'Copy');
