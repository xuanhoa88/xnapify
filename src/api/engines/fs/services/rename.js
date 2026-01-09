/**
 * Rename Service - Worker-enabled wrapper for rename operation
 */

import { rename as renameOperation } from '../operations/rename';
import workerService from '../workers';

/**
 * Thresholds for auto-detection of worker usage
 */
const AUTO_WORKER_THRESHOLDS = Object.freeze({
  opCount: 3, // Use worker for 3+ operations
});

/**
 * Determine whether to use worker process
 * @param {Object} options - Operation options
 * @param {number} opCount - Number of operations
 * @returns {boolean} True if should use worker
 */
function shouldUseWorker(options = {}, opCount = 1) {
  if (options.useWorker === true) return true;
  if (options.useWorker === false) return false;

  return opCount >= AUTO_WORKER_THRESHOLDS.opCount;
}

/**
 * Rename file(s) with optional worker processing
 * @param {Object} manager - FilesystemManager instance
 * @param {Object|Array} renameOperations - Single rename op or array of {oldName, newName}
 * @param {Object} options - Rename options
 * @param {boolean} options.useWorker - Force worker usage (true/false/undefined for auto)
 * @returns {Promise<Object>} Rename result
 */
export async function rename(manager, renameOperations, options = {}) {
  const opList = Array.isArray(renameOperations)
    ? renameOperations
    : [renameOperations];

  if (shouldUseWorker(options, opList.length)) {
    return await workerService.processRename(opList, options);
  }

  return await renameOperation(manager, renameOperations, options);
}
