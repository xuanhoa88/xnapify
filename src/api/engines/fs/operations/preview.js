/**
 * Preview Operations
 */

import {
  FilesystemError,
  createResponse,
  getMimeType,
  getFileCategory,
  getFileExtension,
  formatFileSize,
  isImageFile,
} from '../utils';

/**
 * Preview a file
 * @param {Object} manager - FilesystemManager instance (this)
 * @param {string} fileName - File name
 * @param {Object} options - Preview options
 * @returns {Promise<Object>} Preview result with stream
 */
export async function preview(manager, fileName, options = {}) {
  try {
    const provider = manager.getProvider(options.provider);

    const { stream, metadata } = await provider.retrieve(fileName);
    const mimeType = metadata.mimeType || getMimeType(fileName);
    const category = getFileCategory(fileName);
    const isImage = isImageFile(fileName);
    const isText = category === 'document' || category === 'text';
    const isPdf = mimeType === 'application/pdf';
    const isVideo = category === 'video';
    const isAudio = category === 'audio';
    const isDirectlyPreviewable =
      isImage || isText || isPdf || isVideo || isAudio;

    const contentDisposition = isDirectlyPreviewable
      ? `inline; filename="${metadata.name || fileName}"`
      : `attachment; filename="${metadata.name || fileName}"`;

    return createResponse(
      true,
      {
        fileName,
        stream,
        metadata: {
          name: metadata.name || fileName,
          size: metadata.size,
          formattedSize: formatFileSize(metadata.size),
          mimeType,
          category,
          extension: getFileExtension(fileName),
          isImage,
          isText,
          isPdf,
          isVideo,
          isAudio,
          isDirectlyPreviewable,
        },
        headers: {
          'Content-Type': mimeType,
          'Content-Length': metadata.size,
          'Cache-Control': 'public, max-age=3600',
          'Content-Disposition': contentDisposition,
        },
      },
      'File preview ready',
    );
  } catch (error) {
    if (error instanceof FilesystemError) {
      return createResponse(false, null, error.message, error);
    }
    return createResponse(
      false,
      null,
      'Preview failed',
      new FilesystemError(error.message, 'PREVIEW_FAILED', 500),
    );
  }
}
