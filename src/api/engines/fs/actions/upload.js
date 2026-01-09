/**
 * Upload Actions - File upload operations
 */

import { FilesystemError, createResponse } from '../utils';
import { FilesystemManager } from '../manager';

/**
 * Upload a single file
 * @param {Object} fileData - File data object
 * @param {Object} options - Options
 * @returns {Promise<Object>} Upload result
 */
export async function uploadFile(fileData, options = {}) {
  try {
    const manager = new FilesystemManager(options);

    // Reconstruct buffer if it was serialized for IPC (base64 encoded)
    let { buffer } = fileData;
    if (fileData.bufferEncoding === 'base64' && typeof buffer === 'string') {
      buffer = Buffer.from(buffer, 'base64');
    }

    const result = await manager.store(fileData.fileName, buffer, {
      originalName: fileData.originalName,
      mimeType: fileData.mimeType,
      size: fileData.size,
    });

    return createResponse(
      true,
      {
        fileName: result.fileName || fileData.fileName,
        originalName: fileData.originalName,
        size: fileData.size,
        mimeType: fileData.mimeType,
        uploadedAt: new Date().toISOString(),
      },
      'File uploaded successfully',
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

/**
 * Upload multiple files
 * @param {Array} filesData - Array of file data objects
 * @returns {Promise<Object>} Upload results
 */
export async function uploadFiles(filesData) {
  try {
    if (!Array.isArray(filesData) || filesData.length === 0) {
      throw new FilesystemError(
        'Files data array is required',
        'INVALID_INPUT',
        400,
      );
    }

    const results = await Promise.allSettled(
      filesData.map(async fileData => {
        try {
          const result = await uploadFile(fileData);
          return result;
        } catch (error) {
          return createResponse(
            false,
            { fileName: fileData.fileName },
            `Failed to upload file: ${fileData.originalName}`,
            error,
          );
        }
      }),
    );

    const successful = results
      .filter(r => r.value && r.value.success)
      .map(r => r.value);
    const failed = results
      .filter(r => !r.value || !r.value.success)
      .map(r => r.value || r.reason);

    return createResponse(
      true,
      {
        successful,
        failed,
        totalFiles: filesData.length,
        successCount: successful.length,
        failCount: failed.length,
      },
      `Uploaded ${successful.length} of ${filesData.length} files successfully`,
    );
  } catch (error) {
    return createResponse(
      false,
      null,
      'Batch upload failed',
      new FilesystemError(error.message, 'BATCH_UPLOAD_FAILED', 500),
    );
  }
}
