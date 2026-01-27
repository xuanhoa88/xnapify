/**
 * Remove (Delete) Operations
 */

import { FilesystemError, createOperationResult } from '../utils';

/**
 * Delete file(s)
 * @param {Object} manager - FilesystemManager instance (this)
 * @param {string|Array} fileNames - Single file name or array of file names
 * @param {Object} options - Delete options
 * @returns {Promise<Object>} Delete result
 */
export async function remove(manager, fileNames, options = {}) {
  try {
    const fileList = Array.isArray(fileNames) ? fileNames : [fileNames];
    const provider = manager.getProvider(options.provider);

    if (fileList.length === 0) {
      throw new FilesystemError(
        'At least one file name is required',
        'INVALID_INPUT',
        400,
      );
    }

    const results = [];
    const errors = [];

    for (const fileName of fileList) {
      try {
        await provider.delete(fileName);
        results.push({ fileName, deletedAt: new Date().toISOString() });
      } catch (error) {
        errors.push({ fileName, error: error.message });
      }
    }

    return createOperationResult(
      true,
      {
        successful: results,
        failed: errors,
        totalFiles: fileList.length,
        successCount: results.length,
        failCount: errors.length,
      },
      `Deleted ${results.length} of ${fileList.length} files`,
    );
  } catch (error) {
    if (error instanceof FilesystemError) {
      return createOperationResult(false, null, error.message, error);
    }
    return createOperationResult(
      false,
      null,
      'Delete failed',
      new FilesystemError(error.message, 'DELETE_FAILED', 500),
    );
  }
}
