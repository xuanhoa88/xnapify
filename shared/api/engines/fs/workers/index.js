/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Filesystem Worker Pool - Manages filesystem operations
 * Uses the shared worker engine for worker pool management
 *
 * Features:
 * - Build-time worker discovery via webpack require.context
 * - Hybrid execution: same-process first, fork fallback
 * - Worker pool management with automatic scaling
 * - Comprehensive error handling and recovery
 */

import { createWorkerPool } from '../../worker';
import { FilesystemWorkerError } from '../utils';

// Auto-load workers via require.context (*.worker.js or *.worker.ts)
const workersContext = require.context('./', false, /\.worker\.[cm]?[jt]s$/i);

// Create worker pool with filesystem-specific configuration
const workerPool = createWorkerPool('📁 Filesystem', workersContext, {
  ErrorHandler: FilesystemWorkerError,
});

// ==========================================================================
// HIGH-LEVEL FILESYSTEM OPERATIONS
// ==========================================================================

/**
 * Create ZIP file using worker
 * @param {Array} fileInfos - Array of file information objects
 * @param {string} outputPath - Output file path
 * @param {Object} options - ZIP creation options
 * @returns {Promise<Object>} ZIP result
 */
workerPool.createZipFile = async function createZipFile(
  fileInfos,
  outputPath,
  options = {},
) {
  const { throwOnError, ...zipOptions } = options;
  return await this.sendRequest(
    'zip',
    'ZIP_FILES',
    {
      type: 'CREATE_ZIP',
      fileInfos,
      outputPath,
      options: zipOptions,
    },
    { throwOnError },
  );
};

/**
 * Extract ZIP archive using worker
 * @param {string} zipSource - Path to ZIP file
 * @param {string} extractPath - Directory to extract files to
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extraction result
 */
workerPool.extractZip = async function extractZip(
  zipSource,
  extractPath,
  options = {},
) {
  const { throwOnError, ...extractOptions } = options;
  return await this.sendRequest(
    'zip',
    'ZIP_FILES',
    {
      type: 'EXTRACT_ZIP',
      zipSource,
      extractPath,
      options: extractOptions,
    },
    { throwOnError },
  );
};

/**
 * Process upload operation
 * @param {Array} filesData - Files to upload
 * @param {Object} options - Upload options
 * @param {boolean} options.forceFork - Force fork mode for this request
 * @returns {Promise<Object>} Upload result
 */
workerPool.processUpload = async function processUpload(
  filesData,
  options = {},
) {
  const { forceFork, throwOnError, ...uploadOptions } = options;
  const type =
    Array.isArray(filesData) && filesData.length > 1
      ? 'UPLOAD_BATCH'
      : 'UPLOAD_SINGLE';
  return await this.sendRequest(
    'upload',
    'UPLOAD_FILES',
    {
      type,
      filesData,
      options: uploadOptions,
    },
    { forceFork, throwOnError },
  );
};

/**
 * Process download operation
 * @param {Array} fileNames - Files to download
 * @param {Object} options - Download options
 * @returns {Promise<Object>} Download result
 */
workerPool.processDownload = async function processDownload(
  fileNames,
  options = {},
) {
  const { throwOnError, ...downloadOptions } = options;
  const type =
    Array.isArray(fileNames) && fileNames.length > 1
      ? 'DOWNLOAD_BATCH'
      : 'DOWNLOAD_SINGLE';
  return await this.sendRequest(
    'download',
    'DOWNLOAD_FILES',
    {
      type,
      fileNames,
      options: downloadOptions,
    },
    { throwOnError },
  );
};

/**
 * Process delete operation
 * @param {Array} fileNames - Files to delete
 * @param {Object} options - Delete options
 * @param {boolean} options.forceFork - Force fork mode for this request
 * @returns {Promise<Object>} Delete result
 */
workerPool.processDelete = async function processDelete(
  fileNames,
  options = {},
) {
  const { forceFork, throwOnError, ...deleteOptions } = options;
  const type =
    Array.isArray(fileNames) && fileNames.length > 1
      ? 'DELETE_BATCH'
      : 'DELETE_SINGLE';
  return await this.sendRequest(
    'delete',
    'DELETE_FILES',
    {
      type,
      fileNames,
      options: deleteOptions,
    },
    { forceFork, throwOnError },
  );
};

/**
 * Process rename operation
 * @param {Array} operations - Rename operations
 * @param {Object} options - Rename options
 * @param {boolean} options.forceFork - Force fork mode for this request
 * @returns {Promise<Object>} Rename result
 */
workerPool.processRename = async function processRename(
  operations,
  options = {},
) {
  const { forceFork, throwOnError, ...renameOptions } = options;
  const type =
    Array.isArray(operations) && operations.length > 1
      ? 'RENAME_BATCH'
      : 'RENAME_SINGLE';
  return await this.sendRequest(
    'rename',
    'RENAME_FILES',
    {
      type,
      operations,
      options: renameOptions,
    },
    { forceFork, throwOnError },
  );
};

/**
 * Process copy operation
 * @param {Array} operations - Copy operations
 * @param {Object} options - Copy options
 * @param {boolean} options.forceFork - Force fork mode for this request
 * @returns {Promise<Object>} Copy result
 */
workerPool.processCopy = async function processCopy(operations, options = {}) {
  const { forceFork, throwOnError, ...copyOptions } = options;
  const type =
    Array.isArray(operations) && operations.length > 1
      ? 'COPY_BATCH'
      : 'COPY_SINGLE';
  return await this.sendRequest(
    'copy',
    'COPY_FILES',
    {
      type,
      operations,
      options: copyOptions,
    },
    { forceFork, throwOnError },
  );
};

/**
 * Process sync operation
 * @param {Array} operations - Sync operations
 * @param {Object} options - Sync options
 * @returns {Promise<Object>} Sync result
 */
workerPool.processSync = async function processSync(operations, options = {}) {
  const { throwOnError, ...syncOptions } = options;
  const type =
    Array.isArray(operations) && operations.length > 1
      ? 'SYNC_BATCH'
      : 'SYNC_SINGLE';
  return await this.sendRequest(
    'sync',
    'SYNC_FILES',
    {
      type,
      operations,
      options: syncOptions,
    },
    { throwOnError },
  );
};

/**
 * Process info operation
 * @param {string} fileName - File name
 * @param {Object} options - Info options
 * @returns {Promise<Object>} Info result
 */
workerPool.processInfo = async function processInfo(fileName, options = {}) {
  const { throwOnError, ...infoOptions } = options;
  return await this.sendRequest(
    'info',
    'FILE_INFO',
    {
      type: 'GET_FILE_INFO',
      fileName,
      options: infoOptions,
    },
    { throwOnError },
  );
};

/**
 * Process preview operation
 * @param {string} fileName - File name
 * @param {Object} options - Preview options
 * @returns {Promise<Object>} Preview result
 */
workerPool.processPreview = async function processPreview(
  fileName,
  options = {},
) {
  const { throwOnError, ...previewOptions } = options;
  return await this.sendRequest(
    'info',
    'FILE_INFO',
    {
      type: 'PREVIEW_FILE',
      fileName,
      options: previewOptions,
    },
    { throwOnError },
  );
};

// ==========================================================================
// UNREGISTER OPERATIONS
// ==========================================================================

/**
 * Unregister a specific worker type
 * @param {string} workerType - Worker type to unregister
 * @returns {boolean} True if worker was unregistered
 */
workerPool.unregister = function unregister(workerType) {
  return this.unregisterWorker(workerType);
};

/**
 * Unregister the zip worker
 * @returns {boolean} True if worker was unregistered
 */
workerPool.unregisterZip = function unregisterZip() {
  return this.unregisterWorker('zip');
};

/**
 * Unregister the upload worker
 * @returns {boolean} True if worker was unregistered
 */
workerPool.unregisterUpload = function unregisterUpload() {
  return this.unregisterWorker('upload');
};

/**
 * Unregister the download worker
 * @returns {boolean} True if worker was unregistered
 */
workerPool.unregisterDownload = function unregisterDownload() {
  return this.unregisterWorker('download');
};

/**
 * Unregister the delete worker
 * @returns {boolean} True if worker was unregistered
 */
workerPool.unregisterDelete = function unregisterDelete() {
  return this.unregisterWorker('delete');
};

/**
 * Unregister the rename worker
 * @returns {boolean} True if worker was unregistered
 */
workerPool.unregisterRename = function unregisterRename() {
  return this.unregisterWorker('rename');
};

/**
 * Unregister the copy worker
 * @returns {boolean} True if worker was unregistered
 */
workerPool.unregisterCopy = function unregisterCopy() {
  return this.unregisterWorker('copy');
};

/**
 * Unregister the sync worker
 * @returns {boolean} True if worker was unregistered
 */
workerPool.unregisterSync = function unregisterSync() {
  return this.unregisterWorker('sync');
};

/**
 * Unregister the info worker
 * @returns {boolean} True if worker was unregistered
 */
workerPool.unregisterInfo = function unregisterInfo() {
  return this.unregisterWorker('info');
};

// =============================================================================
// EXPORTS
// =============================================================================

export default workerPool;
