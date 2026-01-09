/**
 * Remove Service - Worker-enabled wrapper for remove operation
 */

import { remove as removeOperation } from '../operations/remove';
import workerService from '../workers';

/**
 * Thresholds for auto-detection of worker usage
 */
const AUTO_WORKER_THRESHOLDS = Object.freeze({
  fileCount: 3, // Use worker for 3+ files
});

/**
 * Determine whether to use worker process
 * @param {Object} options - Operation options
 * @param {number} fileCount - Number of files
 * @returns {boolean} True if should use worker
 */
function shouldUseWorker(options = {}, fileCount = 1) {
  if (options.useWorker === true) return true;
  if (options.useWorker === false) return false;

  return fileCount >= AUTO_WORKER_THRESHOLDS.fileCount;
}

/**
 * Remove file(s) with optional worker processing
 * @param {Object} manager - FilesystemManager instance
 * @param {string|Array} fileNames - Single file name or array of file names
 * @param {Object} options - Remove options
 * @param {boolean} options.useWorker - Force worker usage (true/false/undefined for auto)
 * @returns {Promise<Object>} Remove result
 */
export async function remove(manager, fileNames, options = {}) {
  const fileList = Array.isArray(fileNames) ? fileNames : [fileNames];

  if (shouldUseWorker(options, fileList.length)) {
    return await workerService.processDelete(fileList, options);
  }

  return await removeOperation(manager, fileNames, options);
}
