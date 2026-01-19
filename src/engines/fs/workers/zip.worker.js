/**
 * ZIP Worker - Handles ZIP archive creation
 * Supports both same-process and child process execution
 */

import { createWorkerHandler, setupWorkerProcess } from '../../worker';
import { createZip, extractZip, FilesystemWorkerError } from '../utils';

/**
 * Process ZIP operations (compression and decompression)
 * @param {Object} data - ZIP data
 * @returns {Promise<Object>} ZIP result
 */
async function processZip(data) {
  const { type, fileInfos, options, zipSource, extractPath } = data;

  switch (type) {
    case 'CREATE_ZIP': {
      // Create ZIP archive using archiver (streaming)
      // Note: Returns stream info, not buffer - caller pipes stream to response
      const zipResult = await createZip(fileInfos, options);
      return {
        success: true,
        fileCount: zipResult.fileCount,
        totalSize: zipResult.totalSize,
        zipName: zipResult.zipName,
        errors: zipResult.errors,
        // Stream cannot be serialized through IPC - return metadata only
        // For actual streaming, use direct operation, not worker
        message: 'ZIP created - use direct operation for stream access',
      };
    }

    case 'EXTRACT_ZIP':
    case 'UNZIP':
      // Extract ZIP archive using unzipper (streaming)
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
const workerFunction = createWorkerHandler(processZip, 'ZIP_FILES');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupWorkerProcess(processZip, 'ZIP_FILES', 'ZIP');
