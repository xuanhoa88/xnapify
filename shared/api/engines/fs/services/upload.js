/**
 * Upload Service - Worker-enabled wrapper for upload operation
 */

import { upload as uploadOperation } from '../operations/upload';
import { processUpload } from '../workers';

/**
 * Thresholds for auto-detection of worker usage
 */
const AUTO_WORKER_THRESHOLDS = Object.freeze({
  fileCount: 3, // Use worker for 3+ files
  fileSize: 5 * 1024 * 1024, // Use worker for 5MB+ total
  maxWorkerFileSize: 50 * 1024 * 1024, // Bypass worker for 50MB+ files (avoid IPC overhead)
});

/**
 * Determine whether to use worker process
 * @param {Object} options - Operation options
 * @param {number} fileCount - Number of files
 * @param {number} totalSize - Total size in bytes
 * @returns {boolean} True if should use worker
 */
function shouldUseWorker(options = {}, fileCount = 1, totalSize = 0) {
  if (options.useWorker === true) return true;
  if (options.useWorker === false) return false;

  // Bypass worker for very large files to avoid IPC serialization overhead
  if (totalSize >= AUTO_WORKER_THRESHOLDS.maxWorkerFileSize) {
    return false;
  }

  return (
    fileCount >= AUTO_WORKER_THRESHOLDS.fileCount ||
    totalSize >= AUTO_WORKER_THRESHOLDS.fileSize
  );
}

/**
 * Upload file(s) with optional worker processing
 *
 * @param {Object} manager - FilesystemManager instance
 * @param {Object|Array} files - Single file object or array of files
 * @param {Object} options - Upload options
 * @param {boolean} [options.useWorker] - Worker control:
 *   - `true`: Force worker processing
 *   - `false`: Force direct processing (bypass worker)
 *   - `undefined`: Auto-decide (worker for 3+ files or 5MB+ total)
 * @returns {Promise<Object>} Upload result
 *
 * @example
 * // Auto-decide (default)
 * await fs.upload(manager, file);
 *
 * @example
 * // Force worker processing
 * await fs.upload(manager, file, { useWorker: true });
 *
 * @example
 * // Force direct processing (bypass worker for batch)
 * await fs.upload(manager, files, { useWorker: false });
 */
export async function upload(manager, files, options = {}) {
  const fileList = Array.isArray(files) ? files : [files];
  const totalSize = fileList.reduce((sum, f) => sum + (f.size || 0), 0);

  if (shouldUseWorker(options, fileList.length, totalSize)) {
    return await processUpload(fileList, options);
  }

  return await uploadOperation(manager, files, options);
}
