/**
 * Info Service - Worker-enabled wrapper for info operation
 */

import { info as infoOperation } from '../operations/info';
import workerService from '../workers';

/**
 * Get file info with optional worker processing
 * @param {Object} manager - FilesystemManager instance
 * @param {string} fileName - File name
 * @param {Object} options - Info options
 * @param {boolean} options.useWorker - Force worker usage (true/false)
 * @returns {Promise<Object>} Info result
 */
export async function info(manager, fileName, options = {}) {
  // Info is typically a quick operation, only use worker if explicitly requested
  if (options.useWorker === true) {
    return await workerService.processInfo(fileName, options);
  }

  return await infoOperation(manager, fileName, options);
}
