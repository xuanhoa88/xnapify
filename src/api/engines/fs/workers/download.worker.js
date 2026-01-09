/**
 * Download Worker - Handles file download operations
 * Supports both same-process and child process execution
 */

import { createWorkerHandler, setupWorkerProcess } from '../../worker';
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
      return await fs.download(fileNames[0], options);

    case 'DOWNLOAD_BATCH':
      return await fs.download(fileNames, options);

    default:
      throw new FilesystemWorkerError(`Unknown download type: ${type}`);
  }
}

// Create worker function using helper
const workerFunction = createWorkerHandler(processDownload, 'DOWNLOAD_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupWorkerProcess(processDownload, 'DOWNLOAD_FILES', 'Download');
