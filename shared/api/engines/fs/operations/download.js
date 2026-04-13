/**
 * Download Operations
 */

import {
  FilesystemError,
  createOperationResult,
  createZip,
  config,
} from '../utils';

/**
 * Download file(s)
 * @param {Object} manager - FilesystemManager instance (this)
 * @param {string|Array} fileNames - Single file name or array of file names
 * @param {Object} options - Download options
 * @returns {Promise<Object>} Download result with stream
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
      const { stream, metadata } = await provider.retrieve(fileName);

      return createOperationResult(
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

    // Multiple files - create streaming ZIP
    const fileInfos = [];
    const errors = [];

    for (const fileName of fileList) {
      try {
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

    // Use streaming ZIP creation (no full file buffering)
    const zipResult = await createZip(fileInfos, {
      basePath: config.UPLOAD_DIR,
      compressionLevel: options.compressionLevel || 6,
      zipName: options.zipName || 'files.zip',
    });

    return createOperationResult(
      true,
      {
        type: 'zip',
        stream: zipResult.stream, // Readable stream - pipe to HTTP response
        fileCount: zipResult.fileCount,
        totalSize: zipResult.totalSize,
        errors: [...errors, ...zipResult.errors],
        zipName: zipResult.zipName,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${zipResult.zipName}"`,
        },
      },
      `Created streaming ZIP archive with ${zipResult.fileCount} files`,
    );
  } catch (error) {
    if (error instanceof FilesystemError) {
      return createOperationResult(false, null, error.message, error);
    }
    return createOperationResult(
      false,
      null,
      'Download failed',
      new FilesystemError(error.message, 'DOWNLOAD_FAILED', 500),
    );
  }
}
