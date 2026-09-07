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
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

import archiver from 'archiver';
import unzipper from 'unzipper';

import { PathEscapeError, resolveWithin } from '@shared/utils/atomic/index.js';

import { ERROR_CODES, DEFAULT_CONFIG } from './constants.js';
import { FilesystemError } from './errors.js';

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
    basePath = DEFAULT_CONFIG.UPLOAD_DIR,
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
 * Meter an entry's inflated bytes and fail the stream once they pass `limit`.
 *
 * The central directory's `uncompressedSize` is written by whoever built the
 * archive, so on its own it bounds nothing: an entry may declare 1KB and
 * inflate to gigabytes, and the `zlib.createInflateRaw()` unzipper drives has
 * no output cap of its own. Counting the bytes that actually arrive is what
 * turns `maxSize` from a claim about the header into a limit on the disk.
 *
 * @param {number} limit - Maximum bytes this entry may produce.
 * @param {string} entryName - Entry path, for the error message.
 * @returns {Transform} Transform exposing the byte count as `bytesSeen`.
 */
function createSizeLimiter(limit, entryName) {
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      this.bytesSeen += chunk.length;
      if (this.bytesSeen > limit) {
        callback(
          new FilesystemError(
            `ZIP entry expands beyond its allowed size: ${entryName} (> ${limit} bytes)`,
            ERROR_CODES.FILE_TOO_LARGE,
            400,
          ),
        );
        return;
      }
      callback(null, chunk);
    },
  });
  limiter.bytesSeen = 0;
  return limiter;
}

/**
 * Extract ZIP archive to specified directory (streaming)
 * Uses unzipper for streaming extraction - handles huge ZIP files efficiently.
 *
 * @param {string|Buffer} zipSource - ZIP file path or buffer
 * @param {string} extractPath - Directory to extract files to
 * @param {Object} options - Extraction options
 * @param {boolean} [options.overwrite=false] - Replace entries already on disk
 * @param {number} [options.maxFiles=1000] - Maximum number of entries
 * @param {number} [options.maxSize] - Maximum bytes written across all entries
 * @param {number} [options.maxArchiveSize] - Maximum size of the archive itself
 * @returns {Promise<Object>} Extraction result, `totalSize` being bytes written
 */
export async function extractZip(zipSource, extractPath, options = {}) {
  try {
    const {
      overwrite = false,
      maxFiles = 1000,
      maxSize = 100 * 1024 * 1024, // 100MB
      maxArchiveSize = maxSize,
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

    // Validate the source and measure the archive before opening it
    let archiveSize;
    let openDirectory;
    if (Buffer.isBuffer(zipSource)) {
      archiveSize = zipSource.length;
      openDirectory = () => unzipper.Open.buffer(zipSource);
    } else if (typeof zipSource === 'string') {
      let stats;
      try {
        stats = await fs.promises.stat(zipSource);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        throw new FilesystemError(
          `ZIP file not found: ${zipSource}`,
          ERROR_CODES.FILE_NOT_FOUND,
          404,
        );
      }
      archiveSize = stats.size;
      // Open.file walks the central directory with ranged reads on a file
      // handle. Reading the archive into a Buffer first would mean a
      // multi-gigabyte upload is an out-of-memory kill in the SSR process
      // before either guard below ever gets to reject it.
      openDirectory = () => unzipper.Open.file(zipSource);
    } else {
      throw new FilesystemError(
        'ZIP source must be a Buffer or file path',
        ERROR_CODES.INVALID_INPUT,
        400,
      );
    }

    // Compressed bytes are never meaningfully larger than what they expand to,
    // so an archive bigger than the extraction budget cannot fit within it
    // whatever it contains, and a stat says so before anything is parsed.
    if (archiveSize > maxArchiveSize) {
      throw new FilesystemError(
        `ZIP archive too large (${archiveSize} > ${maxArchiveSize} bytes)`,
        ERROR_CODES.FILE_TOO_LARGE,
        400,
      );
    }

    const directory = await openDirectory();

    // Validate file count
    if (directory.files.length > maxFiles) {
      throw new FilesystemError(
        `ZIP contains too many files (${directory.files.length} > ${maxFiles})`,
        ERROR_CODES.INVALID_INPUT,
        400,
      );
    }

    // Cheap pre-filter on what the archive claims, so an obviously oversized
    // one is refused without opening a single entry. It is not the guarantee:
    // the declared sizes are attacker-controlled, and only the per-entry meter
    // below decides how many bytes reach the disk.
    const declaredSize = directory.files.reduce(
      (sum, file) =>
        sum +
        (Number.isFinite(file.uncompressedSize) ? file.uncompressedSize : 0),
      0,
    );
    if (declaredSize > maxSize) {
      throw new FilesystemError(
        `ZIP uncompressed size too large (${declaredSize} > ${maxSize} bytes)`,
        ERROR_CODES.FILE_TOO_LARGE,
        400,
      );
    }

    results.totalFiles = directory.files.length;

    // Extract files
    for (const file of directory.files) {
      try {
        // Security check: prevent directory traversal (zip-slip). Entry paths
        // come from the archive, so containment has to be verified rather than
        // assumed - path.join() would happily hand back /etc/passwd.
        let entryPath;
        try {
          entryPath = resolveWithin(extractPath, file.path);
        } catch (error) {
          if (!(error instanceof PathEscapeError)) {
            throw error;
          }
          results.errors.push({
            fileName: file.path,
            error: 'ZIP_INVALID_FILE_PATH',
          });
          continue;
        }

        // resolveWithin permits the base directory itself, which as an entry
        // path means the archive is trying to write over the extraction root.
        if (entryPath === path.resolve(extractPath)) {
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

          // Hold the entry to the smaller of what it declared and what is left
          // of the archive-wide budget: a declared size that is absent or not a
          // number must not read as "unlimited".
          const declaredEntrySize = Number.isFinite(file.uncompressedSize)
            ? file.uncompressedSize
            : Infinity;
          const limiter = createSizeLimiter(
            Math.min(declaredEntrySize, maxSize - results.totalSize),
            file.path,
          );

          // Stream file to disk. pipeline(), never .pipe(): .pipe() leaves the
          // write stream neither ended nor destroyed when the source fails, so
          // its fd stays open for the life of the process - a thousand-entry
          // archive of corrupt entries walks the process into EMFILE.
          try {
            await pipeline(
              file.stream(),
              limiter,
              fs.createWriteStream(entryPath),
            );
          } catch (error) {
            // The bytes already written survive the torn-down pipeline, and
            // nothing downstream - a manifest read, a checksum - can tell a
            // truncated entry from a complete one.
            await fs.promises.rm(entryPath, { force: true });
            throw error;
          }

          results.totalSize += limiter.bytesSeen;
          results.extractedFiles.push({
            fileName: file.path,
            type: 'file',
            size: limiter.bytesSeen,
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
