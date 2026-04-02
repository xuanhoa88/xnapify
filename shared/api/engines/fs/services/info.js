/**
 * Info Service - Worker-enabled wrapper for info operation
 */

import { info as infoOperation } from '../operations/info';
import { processInfo } from '../workers';

/**
 * Get file info with optional worker processing
 *
 * @param {Object} manager - FilesystemManager instance
 * @param {string} fileName - File name
 * @param {Object} options - Info options
 * @param {boolean} [options.useWorker] - Worker control:
 *   - `true`: Force worker processing
 *   - `false`: Force direct processing (default)
 *   - `undefined`: Direct processing (info is quick, no auto-worker)
 * @returns {Promise<Object>} Info result
 *
 * @example
 * // Direct processing (default)
 * await fs.info(manager, 'file.txt');
 *
 * @example
 * // Force worker processing
 * await fs.info(manager, 'file.txt', { useWorker: true });
 */
export async function info(manager, fileName, options = {}) {
  // Info is typically a quick operation, only use worker if explicitly requested
  if (options.useWorker === true) {
    return await processInfo(fileName, options);
  }

  return await infoOperation(manager, fileName, options);
}
