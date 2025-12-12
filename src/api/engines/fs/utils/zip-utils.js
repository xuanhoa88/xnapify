/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * ZIP Archive Utilities
 */

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { FilesystemError } from './errors';
import { ERROR_CODES } from './constants';

/**
 * Create ZIP archive from file information
 *
 * @param {Array} fileInfos - Array of file information objects
 * @param {Object} options - ZIP creation options
 * @returns {Promise<Object>} ZIP creation result
 */
export async function createZip(fileInfos, options = {}) {
  try {
    const {
      basePath = '',
      compressionLevel = 6,
      zipName = 'files.zip',
      includeEmptyDirectories = false,
    } = options;

    if (!Array.isArray(fileInfos) || fileInfos.length === 0) {
      throw new FilesystemError(
        'File information array is required',
        ERROR_CODES.INVALID_INPUT,
        400,
      );
    }

    const zip = new AdmZip();
    const results = {
      fileCount: 0,
      totalSize: 0,
      errors: [],
    };

    for (const fileInfo of fileInfos) {
      try {
        const { fileName, originalName } = fileInfo;
        const filePath = basePath ? path.join(basePath, fileName) : fileName;

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          results.errors.push({
            fileName,
            error: 'FILE_NOT_FOUND',
          });
          continue;
        }

        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
          // Add file to ZIP
          const fileBuffer = fs.readFileSync(filePath);
          const entryName = originalName || fileName;

          zip.addFile(entryName, fileBuffer, '', stats.mode);
          results.fileCount++;
          results.totalSize += stats.size;
        } else if (stats.isDirectory() && includeEmptyDirectories) {
          // Add empty directory to ZIP
          zip.addFile(`${fileName}/`, Buffer.alloc(0), '', stats.mode);
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

    // Set compression level
    zip.getEntries().forEach(entry => {
      entry.header.method = compressionLevel > 0 ? 8 : 0; // 8 = deflate, 0 = store
    });

    const buffer = zip.toBuffer();

    return {
      success: true,
      buffer,
      zipName,
      fileCount: results.fileCount,
      totalSize: results.totalSize,
      compressedSize: buffer.length,
      compressionRatio: (
        ((results.totalSize - buffer.length) / results.totalSize) *
        100
      ).toFixed(2),
      errors: results.errors,
    };
  } catch (error) {
    if (error instanceof FilesystemError) {
      throw error;
    }
    throw new FilesystemError(
      `Failed to create ZIP archive: ${error.message}`,
      ERROR_CODES.PROVIDER_ERROR,
      500,
    );
  }
}

/**
 * Extract ZIP archive to specified directory
 *
 * @param {Buffer|string} zipSource - ZIP buffer or file path
 * @param {string} extractPath - Directory to extract files to
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extraction result
 */
export async function extractZip(zipSource, extractPath, options = {}) {
  try {
    const {
      overwrite = false,
      preservePermissions = true,
      maxFiles = 1000,
      maxSize = 100 * 1024 * 1024, // 100MB
    } = options;

    let zip;

    if (Buffer.isBuffer(zipSource)) {
      zip = new AdmZip(zipSource);
    } else if (typeof zipSource === 'string') {
      if (!fs.existsSync(zipSource)) {
        throw new FilesystemError(
          `ZIP file not found: ${zipSource}`,
          ERROR_CODES.FILE_NOT_FOUND,
          404,
        );
      }
      zip = new AdmZip(zipSource);
    } else {
      throw new FilesystemError(
        'ZIP source must be a Buffer or file path',
        ERROR_CODES.INVALID_INPUT,
        400,
      );
    }

    const entries = zip.getEntries();

    if (entries.length > maxFiles) {
      throw new FilesystemError(
        `ZIP contains too many files (${entries.length} > ${maxFiles})`,
        ERROR_CODES.INVALID_INPUT,
        400,
      );
    }

    // Calculate total uncompressed size
    const totalSize = entries.reduce(
      (sum, entry) => sum + entry.header.size,
      0,
    );
    if (totalSize > maxSize) {
      throw new FilesystemError(
        `ZIP uncompressed size too large (${totalSize} > ${maxSize} bytes)`,
        ERROR_CODES.FILE_TOO_LARGE,
        400,
      );
    }

    const results = {
      extractedFiles: [],
      skippedFiles: [],
      errors: [],
      totalFiles: entries.length,
      totalSize,
    };

    // Create extraction directory if it doesn't exist
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    for (const entry of entries) {
      try {
        const entryPath = path.join(extractPath, entry.entryName);

        // Security check: prevent directory traversal
        if (!entryPath.startsWith(path.resolve(extractPath))) {
          results.errors.push({
            fileName: entry.entryName,
            error: 'ZIP_INVALID_FILE_PATH',
          });
          continue;
        }

        if (entry.isDirectory) {
          // Create directory
          if (!fs.existsSync(entryPath)) {
            fs.mkdirSync(entryPath, { recursive: true });
            if (preservePermissions && entry.header.attr) {
              fs.chmodSync(entryPath, entry.header.attr);
            }
          }
          results.extractedFiles.push({
            fileName: entry.entryName,
            type: 'directory',
            size: 0,
          });
        } else {
          // Extract file
          if (fs.existsSync(entryPath) && !overwrite) {
            results.skippedFiles.push({
              fileName: entry.entryName,
              reason: 'File already exists',
            });
            continue;
          }

          // Create parent directory if needed
          const parentDir = path.dirname(entryPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }

          // Extract file
          const fileData = entry.getData();
          fs.writeFileSync(entryPath, fileData);

          if (preservePermissions && entry.header.attr) {
            fs.chmodSync(entryPath, entry.header.attr);
          }

          results.extractedFiles.push({
            fileName: entry.entryName,
            type: 'file',
            size: entry.header.size,
          });
        }
      } catch (error) {
        results.errors.push({
          fileName: entry.entryName,
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
