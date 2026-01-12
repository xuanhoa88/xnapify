/**
 * Download Service - Worker-enabled wrapper for download operation
 */

import { download as downloadOperation } from '../operations/download';
import workerPool from '../workers';

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
 * Download file(s) with optional worker processing
 *
 * @param {Object} manager - FilesystemManager instance
 * @param {string|Array} fileNames - Single file name or array of file names
 * @param {Object} options - Download options
 * @param {boolean} [options.useWorker] - Worker control:
 *   - `true`: Force worker processing
 *   - `false`: Force direct processing (bypass worker)
 *   - `undefined`: Auto-decide (worker for 3+ files)
 * @returns {Promise<Object>} Download result
 *
 * @example
 * // Auto-decide (default)
 * await fs.download(manager, 'file.txt');
 *
 * @example
 * // Force worker processing
 * await fs.download(manager, 'file.txt', { useWorker: true });
 *
 * @example
 * // Force direct processing (bypass worker for batch)
 * await fs.download(manager, files, { useWorker: false });
 */
export async function download(manager, fileNames, options = {}) {
  const fileList = Array.isArray(fileNames) ? fileNames : [fileNames];

  if (shouldUseWorker(options, fileList.length)) {
    return await workerPool.processDownload(fileList, options);
  }

  return await downloadOperation(manager, fileNames, options);
}
