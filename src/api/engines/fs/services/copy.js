/**
 * Copy Service - Worker-enabled wrapper for copy operation
 */

import { copy as copyOperation } from '../operations/copy';
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
 * Copy file(s) with optional worker processing
 * @param {Object} manager - FilesystemManager instance
 * @param {Object|Array} copyOperations - Single copy op or array of {source, target}
 * @param {Object} options - Copy options
 * @param {boolean} options.useWorker - Force worker usage (true/false/undefined for auto)
 * @returns {Promise<Object>} Copy result
 */
export async function copy(manager, copyOperations, options = {}) {
  const opList = Array.isArray(copyOperations)
    ? copyOperations
    : [copyOperations];

  if (shouldUseWorker(options, opList.length)) {
    return await workerService.processCopy(opList, options);
  }

  return await copyOperation(manager, copyOperations, options);
}
