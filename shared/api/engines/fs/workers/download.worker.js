/**
 * Download Worker - Handles file download operations
 * Supports both same-process and child process execution
 */

import { createFactory } from '../factory';
import { FilesystemWorkerError } from '../utils';

/**
 * Process download operations
 * @param {Object} data - Download data
 * @returns {Promise<Object>} Download result
 */
async function processDownload(data) {
  const { type, fileNames, options = {} } = data;
  const fs = createFactory(options);

  switch (type) {
    case 'DOWNLOAD_SINGLE':
      return await fs.download(fileNames[0], { ...options, useWorker: false });

    case 'DOWNLOAD_BATCH':
      return await fs.download(fileNames, { ...options, useWorker: false });

    default:
      throw new FilesystemWorkerError(`Unknown download type: ${type}`);
  }
}

// Create worker function using helper

export { processDownload as DOWNLOAD_FILES };
export default processDownload;
