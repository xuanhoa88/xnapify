/**
 * Upload Worker - Handles file upload operations
 * Supports both same-process and child process execution
 */

import { createWorkerHandler, setupWorkerProcess } from '../../worker';
import { createFactory } from '../factory';
import { FilesystemWorkerError } from '../utils';

/**
 * Process upload operations
 * @param {Object} data - Upload data
 * @returns {Promise<Object>} Upload result
 */
async function processUpload(data) {
  const { type, filesData, options = {} } = data;
  const fs = createFactory(options);

  switch (type) {
    case 'UPLOAD_SINGLE':
      return await fs.upload(filesData[0] || filesData, {
        ...options,
        useWorker: false,
      });

    case 'UPLOAD_BATCH':
      return await fs.upload(filesData, { ...options, useWorker: false });

    default:
      throw new FilesystemWorkerError(`Unknown upload type: ${type}`);
  }
}

// Create worker function using helper
const workerFunction = createWorkerHandler(processUpload, 'UPLOAD_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupWorkerProcess(processUpload, 'UPLOAD_FILES', 'Upload');
