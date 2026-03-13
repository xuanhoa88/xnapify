/**
 * Upload Worker - Handles file upload operations
 * Supports both same-process and child process execution
 */

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

export { processUpload as UPLOAD_FILES };
export default processUpload;
