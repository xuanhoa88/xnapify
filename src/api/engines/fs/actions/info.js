/**
 * Info Actions - File information and preview operations
 */

import {
  FilesystemError,
  getMimeType,
  getFileCategory,
  getFileExtension,
  formatFileSize,
  createResponse,
} from '../utils';
import { FilesystemManager } from '../manager';

/**
 * Get file information and metadata
 * @param {string} fileName - Name of file to get info for
 * @param {Object} options - Options
 * @returns {Promise<Object>} File information result
 */
export async function getFileInfo(fileName, options = {}) {
  try {
    const manager = new FilesystemManager(options);

    // Check if file exists
    const exists = await manager.exists(fileName);
    if (!exists) {
      throw new FilesystemError(
        `File not found: ${fileName}`,
        'FILE_NOT_FOUND',
        404,
      );
    }

    // Get file metadata
    const metadata = await manager.getMetadata(fileName);
    const mimeType = metadata.mimeType || getMimeType(fileName);
    const category = getFileCategory(fileName);

    return createResponse(
      true,
      {
        fileName,
        metadata: {
          name: metadata.name || fileName,
          size: metadata.size,
          formattedSize: formatFileSize(metadata.size),
          mimeType,
          category,
          extension: getFileExtension(fileName),
          created: metadata.created,
          modified: metadata.modified,
        },
        downloadUrl: `/download?fileName=${encodeURIComponent(fileName)}`,
        previewUrl: `/preview?fileName=${encodeURIComponent(fileName)}`,
      },
      'File information retrieved successfully',
    );
  } catch (error) {
    if (error instanceof FilesystemError) {
      return createResponse(false, null, error.message, error);
    }
    return createResponse(
      false,
      null,
      'Get file info failed',
      new FilesystemError(error.message, 'GET_FILE_INFO_FAILED', 500),
    );
  }
}

/**
 * Check if file exists
 * @param {string} fileName - Name of file to check
 * @param {Object} options - Options
 * @returns {Promise<boolean>} True if file exists
 */
export async function fileExists(fileName, options = {}) {
  try {
    const manager = new FilesystemManager(options);
    return await manager.exists(fileName);
  } catch (error) {
    return false;
  }
}
