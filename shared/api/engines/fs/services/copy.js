/**
 * Copy Service - Worker-enabled wrapper for copy operation
 */

import { copy as copyOperation } from '../operations/copy';
import { processCopy } from '../workers';

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
 *
 * @param {Object} manager - FilesystemManager instance
 * @param {Object|Array} copyOperations - Single copy op or array of {source, target}
 * @param {Object} options - Copy options
 * @param {boolean} [options.useWorker] - Worker control:
 *   - `true`: Force worker processing
 *   - `false`: Force direct processing (bypass worker)
 *   - `undefined`: Auto-decide (worker for 3+ operations)
 * @returns {Promise<Object>} Copy result
 *
 * @example
 * // Auto-decide (default)
 * await fs.copy(manager, { source: 'a.txt', target: 'b.txt' });
 *
 * @example
 * // Force worker processing
 * await fs.copy(manager, op, { useWorker: true });
 *
 * @example
 * // Force direct processing (bypass worker for batch)
 * await fs.copy(manager, operations, { useWorker: false });
 */
export async function copy(manager, copyOperations, options = {}) {
  const opList = Array.isArray(copyOperations)
    ? copyOperations
    : [copyOperations];

  if (shouldUseWorker(options, opList.length)) {
    return await processCopy(opList, options);
  }

  return await copyOperation(manager, copyOperations, options);
}
