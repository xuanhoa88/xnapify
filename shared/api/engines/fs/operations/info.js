/**
 * Info Operations
 */

import {
  FilesystemError,
  createOperationResult,
  getMimeType,
  getFileCategory,
  getFileExtension,
  formatFileSize,
} from '../utils';

/**
 * Get file info/metadata
 * @param {Object} manager - FilesystemManager instance (this)
 * @param {string} fileName - File name
 * @param {Object} options - Options
 * @returns {Promise<Object>} File info result
 */
export async function info(manager, fileName, options = {}) {
  try {
    const provider = manager.getProvider(options.provider);

    const metadata = await provider.getMetadata(fileName);
    const mimeType = metadata.mimeType || getMimeType(fileName);
    const category = getFileCategory(fileName);

    return createOperationResult(
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
      'File information retrieved',
    );
  } catch (error) {
    if (error instanceof FilesystemError) {
      return createOperationResult(false, null, error.message, error);
    }
    return createOperationResult(
      false,
      null,
      'Get info failed',
      new FilesystemError(error.message, 'GET_INFO_FAILED', 500),
    );
  }
}
