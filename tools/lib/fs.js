/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fsPromises from 'fs/promises';
import path from 'path';
import { rimraf } from 'rimraf';
import { BuildError, withFileSystemRetry } from './errorHandler';
import { logDebug } from './logger';

/**
 * Validate path for safety
 */
function validatePath(filePath) {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    throw new BuildError('Invalid file path', {
      path: filePath,
      suggestion: 'Provide a valid string path',
    });
  }

  // Check for path traversal attempts
  const normalized = path.normalize(filePath);
  if (normalized.includes('..')) {
    throw new BuildError('Path traversal detected', {
      path: filePath,
      normalized,
      suggestion: 'Avoid using ".." in paths',
    });
  }
}

/**
 * Check if path exists
 */
export async function pathExists(filePath) {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath) {
  validatePath(dirPath);
  await fsPromises.mkdir(dirPath, { recursive: true });
}

/**
 * Read file with error handling and retry logic
 */
export async function readFile(filePath, options = {}) {
  validatePath(filePath);

  return withFileSystemRetry(
    async () => {
      const encoding = options.encoding || 'utf8';
      const content = await fsPromises.readFile(filePath, encoding);
      logDebug(`📖 Read file: ${filePath}`);
      return content;
    },
    { operation: 'readFile', path: filePath },
  );
}

/**
 * Write file with error handling and retry logic
 */
export async function writeFile(filePath, contents, options = {}) {
  validatePath(filePath);

  return withFileSystemRetry(
    async () => {
      const encoding = options.encoding || 'utf8';

      // Ensure parent directory exists
      await ensureDir(path.dirname(filePath));

      await fsPromises.writeFile(filePath, contents, encoding);
      logDebug(`💾 Wrote file: ${filePath}`);
    },
    { operation: 'writeFile', path: filePath },
  );
}

/**
 * Copy file
 */
export async function copyFile(source, target, options = {}) {
  validatePath(source);
  validatePath(target);

  return withFileSystemRetry(
    async () => {
      // Ensure target directory exists
      await ensureDir(path.dirname(target));

      // Use native copyFile for better performance
      await fsPromises.copyFile(source, target);

      // Preserve timestamps if requested
      if (options.preserveTimestamps) {
        const stats = await fsPromises.stat(source);
        await fsPromises.utimes(target, stats.atime, stats.mtime);
      }

      logDebug(`📋 Copied file: ${source} → ${target}`);
    },
    { operation: 'copyFile', source, target },
  );
}

/**
 * Delete file
 */
export async function deleteFile(filePath, options = {}) {
  validatePath(filePath);

  return withFileSystemRetry(
    async () => {
      const exists = await pathExists(filePath);
      if (!exists && !options.force) {
        throw new BuildError('File not found', {
          path: filePath,
          suggestion: 'Use force: true to ignore missing files',
        });
      }

      if (exists) {
        await fsPromises.unlink(filePath);
        logDebug(`🗑️  Deleted file: ${filePath}`);
      }
    },
    { operation: 'deleteFile', path: filePath },
  );
}

/**
 * Get file information
 */
export async function getFileInfo(filePath) {
  try {
    const stats = await fsPromises.stat(filePath);
    return {
      size: stats.size,
      mtime: stats.mtime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      age: Date.now() - stats.mtime.getTime(),
      exists: true,
    };
  } catch {
    return { exists: false };
  }
}

/**
 * Read directory (simple listing or with file types)
 */
export async function readDir(dirPath, options = {}) {
  validatePath(dirPath);

  return withFileSystemRetry(
    async () => {
      const entries = await fsPromises.readdir(dirPath, {
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
export async function copyDir(source, target, options = {}) {
  validatePath(source);
  validatePath(target);

  return withFileSystemRetry(
    async () => {
      // Ensure source exists and is a directory
      const sourceInfo = await getFileInfo(source);
      if (!sourceInfo.exists) {
        throw new BuildError('Source directory not found', {
          path: source,
          suggestion: 'Check if the source directory path is correct',
        });
      }

      if (!sourceInfo.isDirectory) {
        throw new BuildError('Source is not a directory', {
          path: source,
          suggestion: 'Use copyFile for files',
        });
      }

      // Create target directory
      await ensureDir(target);

      // Read source directory
      const entries = await fsPromises.readdir(source, { withFileTypes: true });

      // Copy each entry
      await Promise.all(
        entries.map(async entry => {
          const sourcePath = path.join(source, entry.name);
          const targetPath = path.join(target, entry.name);

          if (entry.isDirectory()) {
            await copyDir(sourcePath, targetPath, options);
          } else if (entry.isFile()) {
            await copyFile(sourcePath, targetPath, options);
          }
        }),
      );

      logDebug(`📦 Copied directory: ${source} → ${target}`);
    },
    { operation: 'copyDir', source, target },
  );
}

/**
 * Clean/delete directory
 * Note: rimraf v4+ is already promise-based, no need for promisify
 * In rimraf v4, glob patterns require { glob: true } option
 */
export async function cleanDir(pattern, options = {}) {
  // Check if pattern contains glob characters (*, ?, [, etc.)
  const isGlobPattern = /[*?[]/.test(pattern);

  // rimraf v4 requires explicit glob: true for glob patterns
  const rimrafOptions = isGlobPattern ? { ...options, glob: true } : options;

  return withFileSystemRetry(
    async () => {
      await rimraf(pattern, rimrafOptions);
      logDebug(`🗑️  Cleaned directory: ${pattern}`);
    },
    { operation: 'cleanDir', pattern },
  );
}

/**
 * Move directory
 */
export async function moveDir(source, target, options = {}) {
  validatePath(source);
  validatePath(target);

  return withFileSystemRetry(
    async () => {
      // Try native rename first (works if on same filesystem)
      try {
        await fsPromises.rename(source, target);
        logDebug(`✅ Moved directory: ${source} → ${target}`);
        return;
      } catch (error) {
        // If rename fails, fall back to copy + delete
        if (error.code !== 'EXDEV') {
          throw error;
        }
      }

      // Copy then delete (cross-filesystem move)
      await copyDir(source, target, options);
      await cleanDir(source);
      logDebug(`✅ Moved directory (cross-filesystem): ${source} → ${target}`);
    },
    { operation: 'moveDir', source, target },
  );
}

/**
 * Get directory size recursively
 */
export async function getDirectorySize(dirPath) {
  validatePath(dirPath);

  async function calculateSize(currentPath) {
    const info = await getFileInfo(currentPath);

    if (!info.exists) return 0;

    if (info.isFile) {
      return info.size;
    }

    if (info.isDirectory) {
      const entries = await fsPromises.readdir(currentPath);
      const sizes = await Promise.all(
        entries.map(entry => calculateSize(path.join(currentPath, entry))),
      );
      return sizes.reduce((sum, size) => sum + size, 0);
    }

    return 0;
  }

  return calculateSize(dirPath);
}
