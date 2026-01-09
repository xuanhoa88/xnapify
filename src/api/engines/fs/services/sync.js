/**
 * Sync Service - Worker-enabled wrapper for sync operation
 */

import { sync as syncOperation } from '../operations/sync';
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
 * Sync file(s) with optional worker processing
 * @param {Object} manager - FilesystemManager instance
 * @param {Object|Array} syncOperations - Sync operation(s)
 * @param {Object} options - Sync options
 * @param {boolean} options.useWorker - Force worker usage (true/false/undefined for auto)
 * @returns {Promise<Object>} Sync result
 */
export async function sync(manager, syncOperations, options = {}) {
  const opList = Array.isArray(syncOperations)
    ? syncOperations
    : [syncOperations];

  if (shouldUseWorker(options, opList.length)) {
    return await workerService.processSync(opList, options);
  }

  return await syncOperation(manager, syncOperations, options);
}
