/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const fs = require('fs/promises');
const path = require('path');

const { logDebug } = require('./logger');
const { withRetryFileSystem } = require('./retry');

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

  // Check for path traversal attempts
  const normalized = path.normalize(filePath);
  if (normalized.includes('..')) {
    throw new Error('Path traversal detected', {
      path: filePath,
      normalized,
      suggestion: 'Avoid using ".." in paths',
    });
  }
}

/**
 * Check if path exists
 */
async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath) {
  validatePath(dirPath);
  try {
    await fs.access(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dirPath, { recursive: true });
    } else {
      throw error;
    }
  }
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

      await fs.writeFile(filePath, contents, encoding);
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
 * Get file information
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
  } catch {
    return { exists: false };
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
 * Uses native fs.rm (Node.js 14.14+)
 */
async function cleanDir(dirPath, options = {}) {
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

module.exports = {
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
