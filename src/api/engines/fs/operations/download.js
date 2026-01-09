/**
 * Download Operations
 */

import {
  FilesystemError,
  createResponse,
  createZip,
  UPLOAD_DIR,
} from '../utils';

/**
 * Download file(s)
 * @param {Object} manager - FilesystemManager instance (this)
 * @param {string|Array} fileNames - Single file name or array of file names
 * @param {Object} options - Download options
 * @returns {Promise<Object>} Download result with stream or ZIP buffer
 */
export async function download(manager, fileNames, options = {}) {
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

    // Single file download
    if (fileList.length === 1) {
      const fileName = fileList[0];
      const exists = await provider.exists(fileName);
      if (!exists) {
        throw new FilesystemError(
          `File not found: ${fileName}`,
          'FILE_NOT_FOUND',
          404,
        );
      }

      const metadata = await provider.getMetadata(fileName);
      const stream = await provider.getStream(fileName);

      return createResponse(
        true,
        {
          fileName,
          stream,
          metadata: {
            name: metadata.name || fileName,
            size: metadata.size,
            mimeType: metadata.mimeType,
          },
          headers: {
            'Content-Type': metadata.mimeType || 'application/octet-stream',
            'Content-Length': metadata.size,
            'Content-Disposition': `attachment; filename="${metadata.name || fileName}"`,
          },
        },
        'File download ready',
      );
    }

    // Multiple files - create ZIP
    const fileInfos = [];
    const errors = [];

    for (const fileName of fileList) {
      try {
        const exists = await provider.exists(fileName);
        if (!exists) {
          errors.push({ fileName, error: 'FILE_NOT_FOUND' });
          continue;
        }
        const metadata = await provider.getMetadata(fileName);
        fileInfos.push({
          fileName,
          originalName: metadata.name || fileName,
          size: metadata.size,
          mimeType: metadata.mimeType,
        });
      } catch (error) {
        errors.push({ fileName, error: error.message });
      }
    }

    if (fileInfos.length === 0) {
      throw new FilesystemError(
        'No valid files found for download',
        'NO_FILES_FOUND',
        404,
      );
    }

    const zipResult = await createZip(fileInfos, {
      basePath: UPLOAD_DIR,
      compressionLevel: options.compressionLevel || 6,
    });

    return createResponse(
      true,
      {
        type: 'zip',
        buffer: zipResult.buffer,
        fileCount: zipResult.fileCount,
        totalSize: zipResult.totalSize,
        errors,
        zipName: options.zipName || 'files.zip',
      },
      `Created ZIP archive with ${zipResult.fileCount} files`,
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
