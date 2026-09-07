/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';

import {
  ensureDir,
  fsyncDir,
  resolveWithin,
  sweepTemps,
  tempSuffix,
  writeFileAtomic,
} from '@shared/utils/atomic/index.js';

import {
  ERROR_CODES,
  FilesystemError,
  DEFAULT_CONFIG,
} from '../utils/index.js';

/**
 * Local Filesystem Provider
 *
 * Provides file storage operations on the local filesystem.
 * Supports file upload, download, deletion, and metadata operations.
 */
/**
 * How a raw errno should present to a caller outside this provider.
 *
 * Without this every failure arrives as PROVIDER_ERROR/500, so a full disk, a
 * permission problem and a name the filesystem will not accept are
 * indistinguishable to a caller — and the two that are the caller's own doing
 * are reported as the server's fault.
 */
const ERRNO_PRESENTATION = Object.freeze({
  EACCES: [ERROR_CODES.PERMISSION_DENIED, 403],
  EPERM: [ERROR_CODES.PERMISSION_DENIED, 403],
  ENOSPC: [ERROR_CODES.STORAGE_FULL, 507],
  EDQUOT: [ERROR_CODES.STORAGE_FULL, 507],
  ENAMETOOLONG: [ERROR_CODES.INVALID_INPUT, 400],
  EISDIR: [ERROR_CODES.INVALID_INPUT, 400],
  ENOTDIR: [ERROR_CODES.INVALID_INPUT, 400],
});

/**
 * Wrap a raw `node:fs` error, keeping the errno legible to callers.
 *
 * @param {string} message - Caller-facing description, already redacted
 * @param {NodeJS.ErrnoException} error - The original error
 * @returns {FilesystemError}
 */
function wrapProviderError(message, error) {
  const [code, statusCode] = ERRNO_PRESENTATION[error?.code] || [
    ERROR_CODES.PROVIDER_ERROR,
    500,
  ];
  const wrapped = new FilesystemError(message, code, statusCode);
  // The errno itself, for a caller deciding whether a retry could help. Kept
  // beside `code` rather than in it, so existing ERROR_CODES checks still work.
  wrapped.errno = error?.code ?? null;
  wrapped.cause = error;
  return wrapped;
}

/**
 * Move `sourcePath` to `destPath` without replacing an existing destination.
 *
 * `link` is the atomic half: the kernel either creates the new name or reports
 * EEXIST, with no window between deciding and doing. The `unlink` after it is
 * what turns two names for one inode back into a move.
 *
 * @param {string} sourcePath - Absolute path to move from
 * @param {string} destPath - Absolute path to move to
 * @param {string} destinationFileName - Caller-facing name, for the error
 * @throws {FilesystemError} TARGET_EXISTS if the destination is taken
 */
async function moveNoClobber(sourcePath, destPath, destinationFileName) {
  const taken = () =>
    new FilesystemError(
      `Destination already exists: ${destinationFileName}`,
      ERROR_CODES.TARGET_EXISTS,
      409,
    );

  try {
    await fs.link(sourcePath, destPath);
  } catch (error) {
    if (error.code === 'EEXIST') throw taken();

    // Hard links are refused for directories (EPERM), across mount points
    // (EXDEV), and by filesystems that have none (ENOTSUP/ENOSYS). No atomic
    // primitive is left, so this degrades to look-then-move — the same race
    // the operation layer ran on its own, now confined to the cases where
    // nothing better exists rather than being the only implementation.
    if (!['EPERM', 'EXDEV', 'ENOTSUP', 'ENOSYS'].includes(error.code))
      throw error;

    let destExists = true;
    try {
      await fs.access(destPath);
    } catch (accessError) {
      if (accessError.code !== 'ENOENT') throw accessError;
      destExists = false;
    }
    if (destExists) throw taken();

    await fs.rename(sourcePath, destPath);
    return;
  }

  try {
    await fs.unlink(sourcePath);
  } catch (error) {
    // The link landed, so the file answers to both names now. Reporting that
    // as a move would be reporting a copy; take the new name back off.
    await fs.unlink(destPath).catch(() => {});
    throw error;
  }
}

export class LocalFilesystemProvider {
  constructor(config = {}) {
    this.basePath = config.basePath || DEFAULT_CONFIG.UPLOAD_DIR;
    this.createDirectories = config.createDirectories !== false;
    this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB default
    this.allowedExtensions = config.allowedExtensions || null; // null = allow all

    // Ensure base directory exists.
    //
    // The rejection has to be caught here rather than left floating: a promise
    // that rejects with no handler attached is an unhandled rejection, which on
    // Node 20 terminates the process — so an unwritable upload directory would
    // kill the worker at boot instead of surfacing when a file is first
    // touched. `ready` lets callers await the outcome if they care.
    this.initError = null;
    this.ready = this.createDirectories
      ? this.ensureDir(this.basePath)
          // Reclaim the temps of writers that never got to clean up after
          // themselves — a SIGKILLed worker, or an upload whose client walked
          // away so the pipeline never settled. Nothing else in the app ever
          // revisits the upload directory, so each of those otherwise costs up
          // to `maxFileSize` of disk permanently. sweepTemps only takes
          // artifacts older than its grace window, so an upload in flight in
          // another worker is left alone.
          .then(() =>
            // An hour, not the default minute. This runs at construction, so it
            // fires on every worker boot and rolling restart, and another
            // worker may be part-way through a large or slow upload right then.
            // Boot-time sweeping exists to reclaim debris from a process that
            // died, and that debris is never seconds old.
            sweepTemps(this.basePath, {
              recursive: true,
              graceMs: 60 * 60_000,
            }),
          )
          .catch(error => {
            this.initError = error;
            console.error(
              `[fs:local] Upload directory ${this.basePath} is unusable: ${error.message}`,
            );
          })
      : Promise.resolve();
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  async ensureDir(dirPath) {
    // `recursive: true` is already idempotent, so the access() probe it
    // replaced only opened a window for a parallel worker to create the
    // directory between the check and the mkdir.
    await ensureDir(dirPath);
  }

  /**
   * Get full file path, confined to `basePath`.
   *
   * `path.join(basePath, fileName)` is not a containment check — it resolves
   * `../../../../etc/passwd` to `/etc/passwd` without complaint — and every
   * operation on this provider routes through here with a name that ultimately
   * came from a request (an upload's filename, a `fileName` query parameter, a
   * stored `profile.picture`). Confining it once, at the single point they all
   * share, is what keeps store/retrieve/delete/exists/stat/copy/move from each
   * needing their own guard and each being a place to forget one.
   *
   * @param {string} fileName - Untrusted, relative to `basePath`.
   * @returns {string}
   * @throws {PathEscapeError} When the name resolves outside `basePath`.
   */
  /**
   * Strip this provider's absolute upload root out of a raw fs error message
   * before it is wrapped for a caller. `FilesystemError#message` reaches
   * clients through the upload middleware and `sendValidationError` — neither
   * of which was written to scrub a value string for a filesystem path — so
   * the host's real upload directory and the `<ts>_<uuid8><ext>` naming
   * scheme would otherwise be visible to anyone who can trigger any local
   * store/copy/move/delete failure (a filename long enough for ENAMETOOLONG
   * is enough, and any authenticated upload can supply one).
   *
   * @param {string} message - A raw `Error#message` from `node:fs`
   * @returns {string}
   */
  redactBasePath(message) {
    return typeof message === 'string'
      ? message.split(this.basePath).join('<upload-root>')
      : message;
  }

  getFilePath(fileName) {
    return resolveWithin(this.basePath, fileName);
  }

  /**
   * Validate file extension
   */
  validateExtension(fileName) {
    if (!this.allowedExtensions) return true;

    const ext = path.extname(fileName).toLowerCase();
    return this.allowedExtensions.includes(ext);
  }

  /**
   * Store a file (accepts Buffer or Readable Stream)
   * @param {string} fileName - Target file name
   * @param {Buffer|Stream} fileData - File content as Buffer or Readable Stream
   * @param {Object} options - Storage options
   * @returns {Promise<Object>} File metadata
   */
  async store(fileName, fileData, options = {}) {
    try {
      // Validate extension
      if (!this.validateExtension(fileName)) {
        throw new FilesystemError(
          `File extension not allowed: ${path.extname(fileName)}`,
        );
      }

      // Ensure directory exists
      const filePath = this.getFilePath(fileName);
      const directory = path.dirname(filePath);
      await this.ensureDir(directory);

      // Detect if fileData is a stream (has pipe method and readable property)
      const isStream =
        fileData &&
        typeof fileData.pipe === 'function' &&
        typeof fileData.on === 'function';

      if (isStream) {
        // Stream mode: write to a temp beside the destination and publish it
        // with a rename, rather than opening the destination itself.
        //
        // A write stream truncates the file it opens before the first byte
        // arrives, so a source that dies mid-body — a client abandoning a
        // multipart upload, a full disk — leaves a readable, wrong-length file
        // under the very name the caller was just told had failed to store,
        // and has already destroyed whatever that name held before. rename(2)
        // is atomic: the destination is either the previous file or the whole
        // new one, and a rejected store publishes nothing at all.
        const tempPath = filePath + tempSuffix();
        let stats;

        try {
          await pipeline(
            fileData,
            // 'wx' rather than the default 'w': the suffix is unique, so a
            // temp that already exists belongs to someone else and truncating
            // it would corrupt their upload.
            createWriteStream(tempPath, { flags: 'wx' }),
          );

          // Reopened purely to fsync. Closing a write stream is not a sync, and
          // the rename below is ordered against the disk while the writes
          // behind it are not, so a power cut here would publish a file whose
          // bytes never landed.
          const handle = await fs.open(tempPath, 'r+');
          try {
            await handle.sync();
            stats = await handle.stat();
          } finally {
            await handle.close();
          }

          if (stats.size > this.maxFileSize) {
            throw new FilesystemError(
              `File size exceeds limit: ${stats.size} > ${this.maxFileSize}`,
            );
          }

          // Carry the replaced file's permissions over. The temp is created
          // fresh and so takes the process umask — typically 0644 — and
          // renaming it over a deliberately restricted file would quietly
          // publish that file to every account on the host. chmod rather than
          // an open() mode because open()'s mode argument is umask-filtered
          // and cannot reproduce 0600 on a umask-022 host.
          const previousMode = await fs
            .stat(filePath)
            .then(prev => prev.mode & 0o7777)
            .catch(() => null);
          if (previousMode !== null) await fs.chmod(tempPath, previousMode);

          await fs.rename(tempPath, filePath);
        } catch (error) {
          // Every failure above, the size rejection included, has to take the
          // temp with it — and a failed unlink must not be reported in place of
          // the reason the store was rejected.
          await fs.unlink(tempPath).catch(() => {});
          throw error;
        }

        // Without this a power cut can lose the rename itself, leaving the
        // bytes on disk under no name at all.
        await fsyncDir(directory);

        return {
          fileName,
          filePath,
          size: stats.size,
          mimeType: options.mimeType || 'application/octet-stream',
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          provider: 'local',
        };
      }

      // Buffer mode: ensure fileData is a real Buffer (handle IPC serialization)
      let buffer = fileData;
      if (!Buffer.isBuffer(fileData)) {
        // Buffer was serialized through IPC - reconstruct it
        if (
          fileData &&
          fileData.type === 'Buffer' &&
          Array.isArray(fileData.data)
        ) {
          // Standard Buffer JSON serialization format: { type: 'Buffer', data: [...] }
          buffer = Buffer.from(fileData.data);
        } else if (fileData && Array.isArray(fileData)) {
          // Plain array of bytes
          buffer = Buffer.from(fileData);
        } else if (fileData && typeof fileData === 'object' && fileData.data) {
          // Object with data property (other serialization formats)
          buffer = Buffer.from(fileData.data);
        } else if (fileData && typeof fileData === 'object') {
          // Try to create buffer from object values (numeric keys)
          const values = Object.values(fileData);
          if (values.length > 0 && typeof values[0] === 'number') {
            buffer = Buffer.from(values);
          } else {
            console.error('[LocalFilesystemProvider] Invalid buffer format:', {
              type: typeof fileData,
              isNull: fileData === null,
              isUndefined: fileData === undefined,
              keys: fileData ? Object.keys(fileData).slice(0, 5) : [],
            });
            throw new FilesystemError(
              'Invalid file buffer provided - unable to reconstruct from serialized data',
            );
          }
        } else {
          console.error(
            '[LocalFilesystemProvider] Buffer is null/undefined:',
            fileData,
          );
          throw new FilesystemError(
            'Invalid file buffer provided - buffer is null or undefined',
          );
        }
      }

      // Validate file size
      if (buffer.length > this.maxFileSize) {
        throw new FilesystemError(
          `File size exceeds limit: ${buffer.length} > ${this.maxFileSize}`,
        );
      }

      // Same temp-then-rename discipline as the stream path: fs.writeFile
      // truncates the destination first, so a write that dies partway through
      // publishes the truncation.
      await writeFileAtomic(filePath, buffer, { ensureDir: false });

      // Return file metadata
      const stats = await fs.stat(filePath);
      return {
        fileName,
        filePath,
        size: stats.size,
        mimeType: options.mimeType || 'application/octet-stream',
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        provider: 'local',
      };
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw wrapProviderError(
        `Failed to store file: ${this.redactBasePath(error.message)}`,
        error,
      );
    }
  }

  /**
   * Get a readable stream for a file
   */
  async retrieve(fileName) {
    try {
      const filePath = this.getFilePath(fileName);

      // stat() first, and only then open the stream.
      //
      // Creating the stream before an `await` that can throw orphans it: the
      // throw jumps to the catch below, nothing ever attaches an 'error'
      // listener, and when the stream reports the same failure Node treats an
      // unhandled 'error' event as an uncaughtException and kills the process.
      // stat() also subsumes the access() probe it replaced — a stat that
      // succeeds proves readability of the entry just as well, with one syscall
      // instead of two and one less TOCTOU window.
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        throw new FilesystemError(`Not a file: ${fileName}`);
      }

      const stream = createReadStream(filePath);

      return {
        stream,
        metadata: {
          fileName,
          filePath,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          provider: 'local',
        },
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new FilesystemError(`File not found: ${fileName}`);
      }
      throw new FilesystemError(`Failed to get file stream: ${error.message}`);
    }
  }

  /**
   * Delete a file
   */
  async delete(fileName) {
    try {
      const filePath = this.getFilePath(fileName);
      await fs.unlink(filePath);
      return { success: true, fileName, provider: 'local' };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new FilesystemError(`File not found: ${fileName}`);
      }
      throw wrapProviderError(
        `Failed to delete file: ${this.redactBasePath(error.message)}`,
        error,
      );
    }
  }

  /**
   * Check if file exists
   */
  async exists(fileName) {
    try {
      const filePath = this.getFilePath(fileName);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getMetadata(fileName) {
    try {
      const filePath = this.getFilePath(fileName);
      const stats = await fs.stat(filePath);

      return {
        fileName,
        filePath,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        provider: 'local',
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new FilesystemError(`File not found: ${fileName}`);
      }
      throw wrapProviderError(
        `Failed to get file metadata: ${this.redactBasePath(error.message)}`,
        error,
      );
    }
  }

  /**
   * List files in directory
   * Supports both relative paths (within basePath) and absolute paths (for sync operations)
   */
  async list(directory = '', options = {}) {
    try {
      let dirPath;

      // Check if directory is an absolute path (for sync operations)
      if (path.isAbsolute(directory)) {
        dirPath = directory;
      } else {
        // Relative path within basePath (normal operation)
        dirPath = directory
          ? path.join(this.basePath, directory)
          : this.basePath;
      }

      const files = await fs.readdir(dirPath, { withFileTypes: true });

      const results = [];
      for (const file of files) {
        const filePath = path.join(dirPath, file.name);

        // The type filters decide what is *reported*, not what is descended
        // into. Skipping a directory outright made `filesOnly` and
        // `recursive` together return only the top level — the filter
        // silently cancelling the traversal the caller asked for.
        const include =
          (!options.filesOnly || file.isFile()) &&
          (!options.directoriesOnly || file.isDirectory());

        if (include) {
          const stats = await fs.stat(filePath);

          results.push({
            name: file.name,
            path: path.isAbsolute(directory)
              ? filePath
              : path.relative(this.basePath, filePath),
            size: stats.size,
            isFile: file.isFile(),
            isDirectory: file.isDirectory(),
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            provider: 'local',
          });
        }

        // Recursive listing if requested.
        //
        // Recursed by the *same* kind of path the caller asked with, not by
        // the absolute one: `path` above is chosen by whether `directory` is
        // absolute, so descending with an absolute path made every nested
        // entry report an absolute path while the top level reported a
        // relative one — one array, two contracts, and the host's upload
        // directory disclosed in half the rows.
        if (options.recursive && file.isDirectory()) {
          const subDirectory = path.isAbsolute(directory)
            ? filePath
            : path.relative(this.basePath, filePath);
          const subFiles = await this.list(subDirectory, options);
          results.push(...subFiles);
        }
      }

      return results;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new FilesystemError(`Directory not found: ${directory}`);
      }
      throw wrapProviderError(
        `Failed to list files: ${this.redactBasePath(error.message)}`,
        error,
      );
    }
  }

  /**
   * Copy a file.
   *
   * Published by rename, like {@link store} and {@link move}, and for the same
   * reason: `copyFile` opens the destination O_TRUNC and streams into it, so a
   * failure partway — ENOSPC, EIO, a source unlinked under it — leaves a
   * truncated file under the destination's real name. The call reports
   * failure, but `exists()` and `getMetadata()` then report that wreckage as a
   * valid file of plausible size, and nothing ever reclaims it. Copying into a
   * temp beside the destination makes the operation all-or-nothing.
   *
   * @param {string} sourceFileName - Name to copy from
   * @param {string} destinationFileName - Name to copy to
   * @param {{ overwrite?: boolean }} [options]
   * @param {boolean} [options.overwrite] - Replace an existing destination.
   *   Default true.
   * @returns {Promise<object>} Copy result
   */
  async copy(sourceFileName, destinationFileName, options = {}) {
    const { overwrite = true } = options;
    try {
      const sourcePath = this.getFilePath(sourceFileName);
      const destPath = this.getFilePath(destinationFileName);

      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await this.ensureDir(destDir);

      const tempPath = destPath + tempSuffix();
      let stats;

      try {
        // COPYFILE_EXCL for the same reason store() opens its temp 'wx': the
        // suffix is unique, so a temp that already exists is someone else's.
        await fs.copyFile(sourcePath, tempPath, fs.constants.COPYFILE_EXCL);

        // Reopened purely to fsync — the rename below is ordered against the
        // disk while the copied bytes behind it are not. Opened read-only on
        // purpose: copyFile carries the source's mode onto the temp, so a
        // read-only source yields a read-only temp, and asking for 'r+' here
        // failed the whole copy with EACCES. fsync needs no write access.
        const handle = await fs.open(tempPath, 'r');
        try {
          await handle.sync();
          stats = await handle.stat();
        } finally {
          await handle.close();
        }

        // Carry the replaced file's permissions over: the temp is created
        // fresh and takes the process umask, so renaming it over a
        // deliberately restricted file would publish that file to every
        // account on the host.
        const previousMode = await fs
          .stat(destPath)
          .then(prev => prev.mode & 0o7777)
          .catch(() => null);
        if (previousMode !== null) await fs.chmod(tempPath, previousMode);

        if (overwrite) {
          await fs.rename(tempPath, destPath);
        } else {
          await moveNoClobber(tempPath, destPath, destinationFileName);
        }
      } catch (error) {
        // Every failure above has to take the temp with it, and a failed
        // unlink must not be reported in place of the reason the copy failed.
        await fs.unlink(tempPath).catch(() => {});
        throw error;
      }

      // Without this a power cut can lose the rename itself, leaving the
      // copied bytes on disk under no name at all.
      await fsyncDir(destDir);

      return {
        sourceFileName,
        destinationFileName,
        size: stats.size,
        createdAt: stats.birthtime,
        provider: 'local',
      };
    } catch (error) {
      // Already carries a code the caller acts on (TARGET_EXISTS from the
      // no-clobber path); rewrapping would erase it.
      if (error instanceof FilesystemError) throw error;
      if (error.code === 'ENOENT') {
        throw new FilesystemError(`Source file not found: ${sourceFileName}`);
      }
      throw wrapProviderError(
        `Failed to copy file: ${this.redactBasePath(error.message)}`,
        error,
      );
    }
  }

  /**
   * Move a file.
   *
   * `overwrite: false` is enforced here rather than by the caller, because a
   * caller can only ask whether the destination is free and act on the answer
   * afterwards — and the answer expires the moment it is given. `link` decides
   * and acts in the same step: it fails EEXIST rather than replacing, which is
   * what `rename` does, silently, to whatever arrived in between.
   *
   * @param {string} sourceFileName - Name to move from
   * @param {string} destinationFileName - Name to move to
   * @param {{ overwrite?: boolean }} [options]
   * @param {boolean} [options.overwrite] - Replace an existing destination.
   *   Default true, matching `rename(2)`.
   * @returns {Promise<object>} Move result
   */
  async move(sourceFileName, destinationFileName, options = {}) {
    const { overwrite = true } = options;
    try {
      const sourcePath = this.getFilePath(sourceFileName);
      const destPath = this.getFilePath(destinationFileName);

      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await this.ensureDir(destDir);

      if (overwrite) {
        await fs.rename(sourcePath, destPath);
      } else {
        await moveNoClobber(sourcePath, destPath, destinationFileName);
      }

      const stats = await fs.stat(destPath);
      return {
        sourceFileName,
        destinationFileName,
        size: stats.size,
        modifiedAt: stats.mtime,
        provider: 'local',
      };
    } catch (error) {
      // Already a filesystem error with a code the caller acts on
      // (TARGET_EXISTS is the reason `overwrite: false` was asked for), so
      // rewrapping it here would erase the answer.
      if (error instanceof FilesystemError) throw error;
      if (error.code === 'ENOENT') {
        throw new FilesystemError(`Source file not found: ${sourceFileName}`);
      }
      throw wrapProviderError(
        `Failed to move file: ${this.redactBasePath(error.message)}`,
        error,
      );
    }
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    try {
      const stats = await fs.stat(this.basePath);
      const files = await this.list('', { filesOnly: true });

      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      return {
        provider: 'local',
        basePath: this.basePath,
        totalFiles: files.length,
        totalSize,
        maxFileSize: this.maxFileSize,
        allowedExtensions: this.allowedExtensions,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    } catch (error) {
      throw new FilesystemError(
        `Failed to get storage stats: ${error.message}`,
      );
    }
  }
}
