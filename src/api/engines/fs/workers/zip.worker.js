/**
 * ZIP Worker - Handles ZIP archive creation
 * Supports both same-process and child process execution
 */

import { createWorker, setupForkMode } from '../../worker';
import { createZip, extractZip, FilesystemWorkerError } from '../utils';

/**
 * Process ZIP operations (compression and decompression)
 * @param {Object} data - ZIP data
 * @returns {Promise<Object>} ZIP result
 */
async function processZip(data) {
  const { type, fileInfos, options, zipSource, extractPath } = data;

  switch (type) {
    case 'CREATE_ZIP':
      // Create ZIP archive using adm-zip
      return await createZip(fileInfos, options);

    case 'EXTRACT_ZIP':
    case 'UNZIP':
      // Extract ZIP archive using adm-zip
      if (!zipSource || !extractPath) {
        throw new FilesystemWorkerError(
          'zipSource and extractPath are required for extraction',
        );
      }
      return await extractZip(zipSource, extractPath, options);

    default:
      throw new FilesystemWorkerError(`Unknown ZIP type: ${type}`);
  }
}

// Create worker function using helper
const workerFunction = createWorker(processZip, 'ZIP_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupForkMode(processZip, 'ZIP_FILES', 'ZIP');
