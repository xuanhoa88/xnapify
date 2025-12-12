/**
 * Download Actions - File download operations
 */

import {
  FilesystemError,
  createResponse,
  createZip,
  UPLOAD_DIR,
} from '../utils';
import { FilesystemManager } from '../manager';

/**
 * Download a single file
 * @param {string} fileName - Name of file to download
 * @param {Object} options - Download options
 * @returns {Promise<Object>} Download result with stream
 */
export async function downloadFile(fileName, options = {}) {
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

    // Get file metadata and stream
    const metadata = await manager.getMetadata(fileName);
    const stream = await manager.getStream(fileName);

    return createResponse(
      true,
      {
        fileName,
        stream,
        metadata: {
          name: metadata.name || fileName,
          size: metadata.size,
          mimeType: metadata.mimeType,
          created: metadata.created,
          modified: metadata.modified,
        },
        headers: {
          'Content-Type': metadata.mimeType || 'application/octet-stream',
          'Content-Length': metadata.size,
          'Content-Disposition': `attachment; filename="${metadata.name || fileName}"`,
        },
      },
      'File download ready',
    );
  } catch (error) {
    if (error instanceof FilesystemError) {
      return createResponse(false, null, error.message, error);
    }
    return createResponse(
      false,
      null,
      'Download failed',
      new FilesystemError(error.message, 'DOWNLOAD_FAILED', 500),
    );
  }
}

/**
 * Download multiple files
 * @param {Array} fileNames - Array of file names to download
 * @param {Object} options - Download options
 * @returns {Promise<Object>} Download result
 */
export async function downloadFiles(fileNames, options = {}) {
  try {
    if (!Array.isArray(fileNames) || fileNames.length === 0) {
      throw new FilesystemError(
        'File names array is required',
        'INVALID_INPUT',
        400,
      );
    }

    const manager = new FilesystemManager(options);

    // Collect file information and validate existence
    const fileInfos = [];
    const errors = [];

    for (const fileName of fileNames) {
      try {
        const exists = await manager.exists(fileName);
        if (!exists) {
          errors.push({
            fileName,
            error: 'FILE_NOT_FOUND',
          });
          continue;
        }

        const metadata = await manager.getMetadata(fileName);
        fileInfos.push({
          fileName,
          originalName: metadata.name || fileName,
          size: metadata.size,
          mimeType: metadata.mimeType,
          downloadUrl: `/download?fileName=${encodeURIComponent(fileName)}`,
        });
      } catch (error) {
        errors.push({
          fileName,
          error: error.message,
        });
      }
    }

    if (fileInfos.length === 0) {
      throw new FilesystemError(
        'No valid files found for download',
        'NO_FILES_FOUND',
      );
    }

    // Always create ZIP for multiple files
    const zipResult = await createZip(fileInfos, {
      basePath: UPLOAD_DIR,
      compressionLevel: options.compressionLevel || 6,
    });

    if (!zipResult.success || zipResult.fileCount === 0) {
      throw new FilesystemError(
        'Failed to create ZIP archive',
        'ZIP_CREATION_FAILED',
        500,
      );
    }

    return createResponse(
      true,
      {
        type: 'zip',
        buffer: zipResult.buffer,
        fileCount: zipResult.fileCount,
        totalSize: zipResult.totalSize,
        errors: zipResult.errors || [],
        zipName: options.zipName || 'files.zip',
      },
      `Created ZIP archive with ${zipResult.fileCount} files`,
    );
  } catch (error) {
    if (error) {
      throw new FilesystemError(
        `ZIP creation failed: ${error.message}`,
        'ZIP_CREATION_FAILED',
        500,
      );
    }
    if (error instanceof FilesystemError) {
      return createResponse(false, null, error.message, error);
    }
    return createResponse(
      false,
      null,
      'Multiple download failed',
      new FilesystemError(error.message, 'MULTIPLE_DOWNLOAD_FAILED', 500),
    );
  }
}
