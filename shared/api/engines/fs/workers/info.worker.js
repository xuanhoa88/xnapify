/**
 * Info Worker - Handles file info and preview operations
 * Supports both same-process and child process execution
 */

import { createFactory } from '../factory';
import { FilesystemWorkerError } from '../utils';

/**
 * Process info operations
 * @param {Object} data - Info data
 * @returns {Promise<Object>} Info result
 */
async function processInfo(data) {
  const { type, fileName, options = {} } = data;
  const fs = createFactory(options);

  switch (type) {
    case 'GET_FILE_INFO':
      return await fs.info(fileName, { ...options, useWorker: false });

    case 'PREVIEW_FILE':
      return await fs.preview(fileName, { ...options, useWorker: false });

    default:
      throw new FilesystemWorkerError(`Unknown info type: ${type}`);
  }
}

// Create worker function using helper

export { processInfo as FILE_INFO };
export default processInfo;
