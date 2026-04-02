/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Filesystem Worker Utilities
 *
 * High-level filesystem operations that resolve batch/single semantics
 * and delegate to the FS factory for actual I/O.
 */

import { createFactory } from '../factory';
import { createZip, extractZip as extractZipUtil } from '../utils';

// ==========================================================================
// ZIP OPERATIONS
// ==========================================================================

/**
 * Create ZIP file
 * @param {Array} fileInfos - Array of file information objects
 * @param {string} outputPath - Output file path
 * @param {Object} options - ZIP creation options
 * @returns {Promise<Object>} ZIP result
 */
export async function createZipFile(fileInfos, outputPath, options = {}) {
  const zipResult = await createZip(fileInfos, options);
  return {
    success: true,
    fileCount: zipResult.fileCount,
    totalSize: zipResult.totalSize,
    zipName: zipResult.zipName,
    errors: zipResult.errors,
  };
}

/**
 * Extract ZIP archive
 * @param {string} zipSource - Path to ZIP file
 * @param {string} extractPath - Directory to extract files to
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extraction result
 */
export async function extractZip(zipSource, extractPath, options = {}) {
  if (!zipSource || !extractPath) {
    throw new Error('zipSource and extractPath are required for extraction');
  }
  return await extractZipUtil(zipSource, extractPath, options);
}

// ==========================================================================
// FILE OPERATIONS
// ==========================================================================

/**
 * Process upload operation
 * @param {Array} filesData - Files to upload
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result
 */
export async function processUpload(filesData, options = {}) {
  const fs = createFactory(options);
  const isBatch = Array.isArray(filesData) && filesData.length > 1;
  return await fs.upload(isBatch ? filesData : filesData[0] || filesData, {
    ...options,
    useWorker: false,
  });
}

/**
 * Process download operation
 * @param {Array} fileNames - Files to download
 * @param {Object} options - Download options
 * @returns {Promise<Object>} Download result
 */
export async function processDownload(fileNames, options = {}) {
  const fs = createFactory(options);
  const isBatch = Array.isArray(fileNames) && fileNames.length > 1;
  return await fs.download(isBatch ? fileNames : fileNames[0], {
    ...options,
    useWorker: false,
  });
}

/**
 * Process delete operation
 * @param {Array} fileNames - Files to delete
 * @param {Object} options - Delete options
 * @returns {Promise<Object>} Delete result
 */
export async function processDelete(fileNames, options = {}) {
  const fs = createFactory(options);
  return await fs.remove(fileNames, { ...options, useWorker: false });
}

/**
 * Process rename operation
 * @param {Array|Object} operations - Rename operations
 * @param {Object} options - Rename options
 * @returns {Promise<Object>} Rename result
 */
export async function processRename(operations, options = {}) {
  const fs = createFactory(options);
  const isBatch = Array.isArray(operations) && operations.length > 1;
  if (isBatch) {
    return await fs.rename(operations.renameOperations, {
      ...operations.options,
      useWorker: false,
    });
  }
  const { oldName, newName, options: singleOptions } = operations;
  return await fs.rename(
    { oldName, newName },
    { ...(singleOptions || options), useWorker: false },
  );
}

/**
 * Process copy operation
 * @param {Array|Object} operations - Copy operations
 * @param {Object} options - Copy options
 * @returns {Promise<Object>} Copy result
 */
export async function processCopy(operations, options = {}) {
  const fs = createFactory(options);
  const isBatch = Array.isArray(operations) && operations.length > 1;
  if (isBatch) {
    return await fs.copy(operations, { ...options, useWorker: false });
  }
  const { sourceFileName, targetFileName, options: singleOptions } = operations;
  return await fs.copy(
    { source: sourceFileName, target: targetFileName },
    { ...(singleOptions || options), useWorker: false },
  );
}

/**
 * Process sync operation
 * @param {Array|Object} operations - Sync operations
 * @param {Object} options - Sync options
 * @returns {Promise<Object>} Sync result
 */
export async function processSync(operations, options = {}) {
  const fs = createFactory(options);
  const isBatch = Array.isArray(operations) && operations.length > 1;
  const data = isBatch
    ? operations
    : Array.isArray(operations)
      ? operations[0]
      : operations;
  return await fs.sync(data, { ...options, useWorker: false });
}

/**
 * Process info operation
 * @param {string} fileName - File name
 * @param {Object} options - Info options
 * @returns {Promise<Object>} Info result
 */
export async function processInfo(fileName, options = {}) {
  const fs = createFactory(options);
  return await fs.info(fileName, { ...options, useWorker: false });
}

/**
 * Process preview operation
 * @param {string} fileName - File name
 * @param {Object} options - Preview options
 * @returns {Promise<Object>} Preview result
 */
export async function processPreview(fileName, options = {}) {
  const fs = createFactory(options);
  return await fs.preview(fileName, { ...options, useWorker: false });
}
