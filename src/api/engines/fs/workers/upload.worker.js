/**
 * Upload Worker - Handles file upload operations
 * Supports both same-process and child process execution
 */

import { uploadFile, uploadFiles } from '../actions/upload';
import { setupForkMode, createWorker, FilesystemWorkerError } from '../utils';

/**
 * Process upload operations
 * @param {Object} data - Upload data
 * @returns {Promise<Object>} Upload result
 */
async function processUpload(data) {
  const { type, filesData } = data;

  switch (type) {
    case 'UPLOAD_SINGLE':
      return await uploadFile(filesData);

    case 'UPLOAD_BATCH':
      return await uploadFiles(filesData);

    default:
      throw new FilesystemWorkerError(`Unknown upload type: ${type}`);
  }
}

// Create worker function using helper
const workerFunction = createWorker(processUpload, 'UPLOAD_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupForkMode(processUpload, 'UPLOAD_FILES', 'Upload');
