/**
 * Sync Service - Worker-enabled wrapper for sync operation
 */

import { sync as syncOperation } from '../operations/sync';
import workerPool from '../workers';

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
 *
 * @param {Object} manager - FilesystemManager instance
 * @param {Object|Array} syncOperations - Sync operation(s)
 * @param {Object} options - Sync options
 * @param {boolean} [options.useWorker] - Worker control:
 *   - `true`: Force worker processing
 *   - `false`: Force direct processing (bypass worker)
 *   - `undefined`: Auto-decide (worker for 3+ operations)
 * @returns {Promise<Object>} Sync result
 *
 * @example
 * // Auto-decide (default)
 * await fs.sync(manager, { source: 'a.txt', target: 'b.txt' });
 *
 * @example
 * // Force worker processing
 * await fs.sync(manager, op, { useWorker: true });
 *
 * @example
 * // Force direct processing (bypass worker for batch)
 * await fs.sync(manager, operations, { useWorker: false });
 */
export async function sync(manager, syncOperations, options = {}) {
  const opList = Array.isArray(syncOperations)
    ? syncOperations
    : [syncOperations];

  if (shouldUseWorker(options, opList.length)) {
    return await workerPool.processSync(opList, options);
  }

  return await syncOperation(manager, syncOperations, options);
}
