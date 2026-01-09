/**
 * Upload Operations
 */

import { FilesystemError, createResponse } from '../utils';

/**
 * Upload file(s)
 * @param {Object} manager - FilesystemManager instance (this)
 * @param {Object|Array} files - Single file object or array of files
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result
 */
export async function upload(manager, files, options = {}) {
  try {
    const fileList = Array.isArray(files) ? files : [files];

    if (fileList.length === 0) {
      throw new FilesystemError(
        'At least one file is required',
        'INVALID_INPUT',
        400,
      );
    }

    const provider = manager.getProvider(options.provider);
    const results = [];
    const errors = [];

    for (const fileData of fileList) {
      try {
        // Reconstruct buffer if it was serialized for IPC
        let { buffer } = fileData;
        if (
          fileData.bufferEncoding === 'base64' &&
          typeof buffer === 'string'
        ) {
          buffer = Buffer.from(buffer, 'base64');
        }

        const result = await provider.store(fileData.fileName, buffer, {
          originalName: fileData.originalName,
          mimeType: fileData.mimeType,
          size: fileData.size,
        });

        results.push({
          success: true,
          fileName: result.fileName || fileData.fileName,
          originalName: fileData.originalName,
          size: fileData.size,
          mimeType: fileData.mimeType,
          uploadedAt: new Date().toISOString(),
        });
      } catch (error) {
        errors.push({
          success: false,
          fileName: fileData.fileName,
          error: error.message,
        });
      }
    }

    return createResponse(
      true,
      {
        successful: results,
        failed: errors,
        totalFiles: fileList.length,
        successCount: results.length,
        failCount: errors.length,
      },
      `Uploaded ${results.length} of ${fileList.length} files`,
    );
  } catch (error) {
    if (error instanceof FilesystemError) {
      return createResponse(false, null, error.message, error);
    }
    return createResponse(
      false,
      null,
      'Upload failed',
      new FilesystemError(error.message, 'UPLOAD_FAILED', 500),
    );
  }
}
