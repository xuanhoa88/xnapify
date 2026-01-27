/**
 * Delete Worker - Handles file delete operations
 * Supports both same-process and child process execution
 */

import { createWorkerHandler, setupWorkerProcess } from '../../worker';
import { createFactory } from '../factory';
import { FilesystemWorkerError } from '../utils';

/**
 * Process delete operations
 * @param {Object} data - Delete data
 * @returns {Promise<Object>} Delete result
 */
async function processDelete(data) {
  const { type, fileNames, options = {} } = data;
  const fs = createFactory(options);

  switch (type) {
    case 'DELETE_SINGLE':
      return await fs.remove(fileNames, { ...options, useWorker: false });

    case 'DELETE_BATCH':
      return await fs.remove(fileNames, { ...options, useWorker: false });

    default:
      throw new FilesystemWorkerError(`Unknown delete type: ${type}`);
  }
}

// Create worker function using helper
const workerFunction = createWorkerHandler(processDelete, 'DELETE_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupWorkerProcess(processDelete, 'DELETE_FILES', 'Delete');
