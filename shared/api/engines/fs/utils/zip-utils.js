/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * ZIP Archive Utilities
 * Uses archiver for creation and unzipper for extraction (streaming)
 */

import fs from 'fs';
import path from 'path';

import archiver from 'archiver';
import unzipper from 'unzipper';

import { ERROR_CODES, UPLOAD_DIR } from './constants';
import { FilesystemError } from './errors';

/**
 * Create ZIP archive from file information (streaming)
 * Streams files directly to output without buffering entire files in memory.
 * Returns a stream that can be piped to HTTP response or file.
 *
 * @param {Array} fileInfos - Array of file information objects
 * @param {Object} options - ZIP creation options
 * @returns {Promise<Object>} Object containing stream and metadata
 */
export async function createZip(fileInfos, options = {}) {
  const {
    basePath = UPLOAD_DIR,
    compressionLevel = 6,
    zipName = 'files.zip',
  } = options;

  if (!Array.isArray(fileInfos) || fileInfos.length === 0) {
    throw new FilesystemError(
      'File information array is required',
      ERROR_CODES.INVALID_INPUT,
      400,
    );
  }

  // Create archiver instance with compression settings
  const archive = archiver('zip', {
    zlib: { level: compressionLevel },
  });

  const results = {
    fileCount: 0,
    totalSize: 0,
    errors: [],
  };

  // Add files to archive using streams (not buffers)
  for (const fileInfo of fileInfos) {
    try {
      const { fileName, originalName } = fileInfo;
      const filePath = basePath ? path.join(basePath, fileName) : fileName;

      // Check if file exists (async)
      try {
        await fs.promises.access(filePath);
      } catch {
        results.errors.push({
          fileName,
          error: 'FILE_NOT_FOUND',
        });
        continue;
      }

      const stats = await fs.promises.stat(filePath);

      if (stats.isFile()) {
        // Stream file to archive (no full file buffering)
        const fileStream = fs.createReadStream(filePath);
        const entryName = originalName || fileName;

        archive.append(fileStream, { name: entryName });
        results.fileCount++;
        results.totalSize += stats.size;
      }
    } catch (error) {
      results.errors.push({
        fileName: fileInfo.fileName,
        error: error.message,
      });
    }
  }

  if (results.fileCount === 0) {
    throw new FilesystemError(
      'No valid files found to create ZIP archive',
      ERROR_CODES.INVALID_INPUT,
      400,
    );
  }

  // Finalize the archive (this must be called after appending all files)
  archive.finalize();

  return {
    stream: archive, // Readable stream - pipe to response
    zipName,
    fileCount: results.fileCount,
    totalSize: results.totalSize,
    errors: results.errors,
  };
}

/**
 * Extract ZIP archive to specified directory (streaming)
 * Uses unzipper for streaming extraction - handles huge ZIP files efficiently.
 *
 * @param {string|Buffer} zipSource - ZIP file path or buffer
 * @param {string} extractPath - Directory to extract files to
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extraction result
 */
export async function extractZip(zipSource, extractPath, options = {}) {
  try {
    const {
      overwrite = false,
      maxFiles = 1000,
      maxSize = 100 * 1024 * 1024, // 100MB
    } = options;

    // Create extraction directory if it doesn't exist
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    const results = {
      extractedFiles: [],
      skippedFiles: [],
      errors: [],
      totalFiles: 0,
      totalSize: 0,
    };

    // Validate source and get buffer for parsing
    let zipBuffer;
    if (Buffer.isBuffer(zipSource)) {
      zipBuffer = zipSource;
    } else if (typeof zipSource === 'string') {
      if (!fs.existsSync(zipSource)) {
        throw new FilesystemError(
          `ZIP file not found: ${zipSource}`,
          ERROR_CODES.FILE_NOT_FOUND,
          404,
        );
      }
      zipBuffer = await fs.promises.readFile(zipSource);
    } else {
      throw new FilesystemError(
        'ZIP source must be a Buffer or file path',
        ERROR_CODES.INVALID_INPUT,
        400,
      );
    }

    // Parse ZIP using unzipper
    const directory = await unzipper.Open.buffer(zipBuffer);

    // Validate file count
    if (directory.files.length > maxFiles) {
      throw new FilesystemError(
        `ZIP contains too many files (${directory.files.length} > ${maxFiles})`,
        ERROR_CODES.INVALID_INPUT,
        400,
      );
    }

    // Calculate total uncompressed size
    const totalSize = directory.files.reduce(
      (sum, file) => sum + file.uncompressedSize,
      0,
    );
    if (totalSize > maxSize) {
      throw new FilesystemError(
        `ZIP uncompressed size too large (${totalSize} > ${maxSize} bytes)`,
        ERROR_CODES.FILE_TOO_LARGE,
        400,
      );
    }

    results.totalFiles = directory.files.length;
    results.totalSize = totalSize;

    // Extract files
    for (const file of directory.files) {
      try {
        const entryPath = path.join(extractPath, file.path);

        // Security check: prevent directory traversal
        if (!entryPath.startsWith(path.resolve(extractPath))) {
          results.errors.push({
            fileName: file.path,
            error: 'ZIP_INVALID_FILE_PATH',
          });
          continue;
        }

        if (file.type === 'Directory') {
          // Create directory
          if (!fs.existsSync(entryPath)) {
            fs.mkdirSync(entryPath, { recursive: true });
          }
          results.extractedFiles.push({
            fileName: file.path,
            type: 'directory',
            size: 0,
          });
        } else {
          // Extract file
          if (fs.existsSync(entryPath) && !overwrite) {
            results.skippedFiles.push({
              fileName: file.path,
              reason: 'File already exists',
            });
            continue;
          }

          // Create parent directory if needed
          const parentDir = path.dirname(entryPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }

          // Stream file to disk
          const writeStream = fs.createWriteStream(entryPath);
          const fileStream = file.stream();
          await new Promise((resolve, reject) => {
            fileStream.pipe(writeStream);
            fileStream.on('error', reject);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          });

          results.extractedFiles.push({
            fileName: file.path,
            type: 'file',
            size: file.uncompressedSize,
          });
        }
      } catch (error) {
        results.errors.push({
          fileName: file.path,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      extractPath,
      ...results,
    };
  } catch (error) {
    if (error instanceof FilesystemError) {
      throw error;
    }
    throw new FilesystemError(
      `Failed to extract ZIP archive: ${error.message}`,
      ERROR_CODES.PROVIDER_ERROR,
      500,
    );
  }
}
