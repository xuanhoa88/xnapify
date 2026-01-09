/**
 * Download Worker - Handles file download operations
 * Supports both same-process and child process execution
 */

import { createWorker, setupForkMode } from '../../worker';
import { downloadFile, downloadFiles } from '../actions/download';
import { FilesystemWorkerError } from '../utils';

/**
 * Process download operations
 * @param {Object} data - Download data
 * @returns {Promise<Object>} Download result
 */
async function processDownload(data) {
  const { type, fileNames, options } = data;

  switch (type) {
    case 'DOWNLOAD_SINGLE':
      return await downloadFile(fileNames[0], options);

    case 'DOWNLOAD_BATCH':
      return await downloadFiles(fileNames, options);

    default:
      throw new FilesystemWorkerError(`Unknown download type: ${type}`);
  }
}

// Create worker function using helper
const workerFunction = createWorker(processDownload, 'DOWNLOAD_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupForkMode(processDownload, 'DOWNLOAD_FILES', 'Download');
