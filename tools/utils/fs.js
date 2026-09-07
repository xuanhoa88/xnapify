/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs/promises';
import path from 'path';

import {
  ensureDir as ensureDirAtomic,
  isMissingFsError,
  mapLimit,
  writeFileAtomic,
} from '../atomic/index.js';

import { logDebug } from './logger.js';
import { withRetryFileSystem } from './retry.js';

/**
 * Validate path for safety
 */
function validatePath(filePath) {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    throw new Error('Invalid file path', {
      path: filePath,
      suggestion: 'Provide a valid string path',
    });
  }

  // Check for path traversal attempts as explicit path segments
  const normalized = path.normalize(filePath);
  if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(normalized)) {
    throw new Error('Path traversal detected', {
      path: filePath,
      normalized,
      suggestion: 'Avoid using ".." in paths',
    });
  }
}

/**
 * Check if path exists.
 *
 * Only a genuinely absent path answers `false`. EACCES, ELOOP and EMFILE are
 * refusals to answer, and the build's callers act on this boolean by silently
 * *skipping* work — the LICENSE, the public asset tree, the .npmrc — so
 * collapsing them into `false` ships an incomplete artifact and still exits 0.
 *
 * @param {string} filePath - Path to test
 * @returns {Promise<boolean>} Whether the path exists
 * @throws {Error} If the path could not be tested at all
 */
async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (isMissingFsError(error)) return false;
    throw error;
  }
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath) {
  validatePath(dirPath);
  // `mkdir -p` is already idempotent; the access() probe it replaced only added
  // a window for a parallel build task to create the directory in between.
  await ensureDirAtomic(dirPath);
}

/**
 * Read file with error handling and retry logic
 */
async function readFile(filePath, options = {}) {
  validatePath(filePath);

  return withRetryFileSystem(
    async () => {
      const encoding = options.encoding || 'utf8';
      const content = await fs.readFile(filePath, encoding);
      logDebug(`📖 Read file: ${filePath}`);
      return content;
    },
    { operation: 'readFile', path: filePath },
  );
}

/**
 * Write file with error handling and retry logic
 */
async function writeFile(filePath, contents, options = {}) {
  validatePath(filePath);

  return withRetryFileSystem(
    async () => {
      const encoding = options.encoding || 'utf8';

      // Ensure parent directory exists
      await ensureDir(path.dirname(filePath));

      // Atomic, which is also what makes the surrounding retry safe: a plain
      // writeFile truncates the target first, so attempt 1 could destroy the
      // previous contents and attempt 2 would then be retrying against a file
      // it had already ruined. Writing aside and renaming leaves the original
      // untouched until a complete replacement exists.
      //
      // `mode` is forwarded so callers writing secrets can demand 0600 rather
      // than inheriting whatever the umask happens to be.
      await writeFileAtomic(filePath, contents, {
        encoding,
        mode: options.mode,
      });
      logDebug(`💾 Wrote file: ${filePath}`);
    },
    { operation: 'writeFile', path: filePath },
  );
}

/**
 * Copy file
 */
async function copyFile(source, target, options = {}) {
  validatePath(source);
  validatePath(target);

  return withRetryFileSystem(
    async () => {
      // Ensure target directory exists
      await ensureDir(path.dirname(target));

      // Use native copyFile for better performance
      await fs.copyFile(source, target);

      // Preserve timestamps if requested
      if (options.preserveTimestamps) {
        const stats = await fs.stat(source);
        await fs.utimes(target, stats.atime, stats.mtime);
      }

      logDebug(`📋 Copied file: ${source} → ${target}`);
    },
    { operation: 'copyFile', source, target },
  );
}

/**
 * Get file information.
 *
 * The miss carries `size: 0` rather than no size at all: callers sum this
 * field without checking `exists` first, and one `undefined` turns the whole
 * running total — and every figure derived from it — into NaN.
 *
 * @param {string} filePath - Path to stat
 * @returns {Promise<object>} File information, or `{ exists: false, size: 0 }`
 */
async function getFileInfo(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      mtime: stats.mtime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      age: Date.now() - stats.mtime.getTime(),
      exists: true,
    };
  } catch (error) {
    if (!isMissingFsError(error)) {
      // Distinguishable in the log from "it is not there", which is what a
      // caller that skips on `exists: false` would otherwise conclude.
      logDebug(`Could not stat ${filePath}: ${error.message}`);
    }
    return { exists: false, size: 0 };
  }
}

/**
 * Read directory (simple listing or with file types)
 */
async function readDir(dirPath, options = {}) {
  validatePath(dirPath);

  return withRetryFileSystem(
    async () => {
      const entries = await fs.readdir(dirPath, {
        withFileTypes: options.withFileTypes || false,
      });
      logDebug(`📂 Read ${entries.length} entries from: ${dirPath}`);
      return entries;
    },
    { operation: 'readDir', path: dirPath },
  );
}

/**
 * Copy directory recursively
 */
async function copyDir(source, target, options = {}) {
  validatePath(source);
  validatePath(target);

  // Retried once at the top rather than at every level: the recursive call and
  // the per-file copy are each wrapped too, so a failure N directories deep used
  // to be retried 3^(N+1) times, turning one EACCES into minutes of backoff.
  return copyDirInner(source, target, options);
}

async function copyDirInner(source, target, options = {}) {
  return withRetryFileSystem(
    async () => {
      // Ensure source exists and is a directory
      const sourceInfo = await getFileInfo(source);
      if (!sourceInfo.exists) {
        throw new Error('Source directory not found', {
          path: source,
          suggestion: 'Check if the source directory path is correct',
        });
      }

      if (!sourceInfo.isDirectory) {
        throw new Error('Source is not a directory', {
          path: source,
          suggestion: 'Use copyFile for files',
        });
      }

      // Create target directory
      await ensureDir(target);

      // Read source directory
      const entries = await fs.readdir(source, { withFileTypes: true });

      // Bounded fan-out. An unbounded Promise.all over a large tree opens one
      // descriptor per entry at once and hits EMFILE, which then surfaces as
      // unrelated open() failures elsewhere in the build.
      const results = await mapLimit(entries, async entry => {
        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);

        if (entry.isDirectory()) {
          await copyDirInner(sourcePath, targetPath, options);
        } else if (entry.isFile()) {
          await copyFile(sourcePath, targetPath, options);
        } else if (entry.isSymbolicLink()) {
          // readdir reports dirent types from lstat, so a symlink is neither
          // isFile() nor isDirectory() — it used to fall through both arms and
          // vanish from the copy while the success line below still printed.
          // Recreated as a link rather than followed, so a tree that vendors a
          // shared asset by symlink arrives intact instead of duplicated.
          const linkTarget = await fs.readlink(sourcePath);
          await fs.unlink(targetPath).catch(() => {});
          await fs.symlink(linkTarget, targetPath);
        } else {
          // Sockets, FIFOs, devices: nothing a build tree should contain, and
          // silently dropping them is how the caller ends up trusting an
          // incomplete copy.
          throw new Error(
            `copyDir: refusing to copy unsupported entry ${sourcePath}`,
          );
        }
      });

      const failed = results.find(r => r.status === 'rejected');
      if (failed) throw failed.reason;

      logDebug(`📦 Copied directory: ${source} → ${target}`);
    },
    { operation: 'copyDir', source, target },
  );
}

/**
 * Clean/delete directory
 * Uses native fs.rm (Node.js 14.14+)
 */
async function cleanDir(dirPath, options = {}) {
  // The one helper that recursively force-deletes, and the only one that used
  // to skip this check — so a caller-supplied `..` reached `rm -rf` unvalidated.
  validatePath(dirPath);

  return withRetryFileSystem(
    async () => {
      await fs.rm(dirPath, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
        ...options,
      });
      logDebug(`🗑️  Cleaned directory: ${dirPath}`);
    },
    { operation: 'cleanDir', path: dirPath },
  );
}

export {
  pathExists,
  ensureDir,
  readFile,
  writeFile,
  copyFile,
  getFileInfo,
  readDir,
  copyDir,
  cleanDir,
  withRetryFileSystem,
};
