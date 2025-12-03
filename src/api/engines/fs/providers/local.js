/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { FilesystemError } from '../utils';

/**
 * Local Filesystem Provider
 *
 * Provides file storage operations on the local filesystem.
 * Supports file upload, download, deletion, and metadata operations.
 */
export class LocalFilesystemProvider {
  constructor(config = {}) {
    this.basePath = config.basePath || path.join(process.cwd(), 'uploads');
    this.createDirectories = config.createDirectories !== false;
    this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB default
    this.allowedExtensions = config.allowedExtensions || null; // null = allow all

    // Ensure base directory exists
    if (this.createDirectories) {
      this.ensureDir(this.basePath);
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  async ensureDir(dirPath) {
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
   * Get full file path
   */
  getFilePath(fileName) {
    return path.join(this.basePath, fileName);
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
   * Store a file
   */
  async store(fileName, fileBuffer, options = {}) {
    try {
      // Validate extension
      if (!this.validateExtension(fileName)) {
        throw new FilesystemError(
          `File extension not allowed: ${path.extname(fileName)}`,
        );
      }

      // Validate file size
      if (fileBuffer.length > this.maxFileSize) {
        throw new FilesystemError(
          `File size exceeds limit: ${fileBuffer.length} > ${this.maxFileSize}`,
        );
      }

      // Ensure directory exists
      const filePath = this.getFilePath(fileName);
      const directory = path.dirname(filePath);
      await this.ensureDir(directory);

      // Write file
      await fs.writeFile(filePath, fileBuffer);

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
      throw new FilesystemError(`Failed to store file: ${error.message}`);
    }
  }

  /**
   * Store a file from stream
   */
  async storeStream(fileName, readableStream, options = {}) {
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

      // Create write stream and pipe
      const writeStream = createWriteStream(filePath);
      await pipeline(readableStream, writeStream);

      // Return file metadata
      const stats = await fs.stat(filePath);

      // Validate file size after writing
      if (stats.size > this.maxFileSize) {
        await this.delete(fileName); // Clean up
        throw new FilesystemError(
          `File size exceeds limit: ${stats.size} > ${this.maxFileSize}`,
        );
      }

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
      throw new FilesystemError(
        `Failed to store file from stream: ${error.message}`,
      );
    }
  }

  /**
   * Retrieve a file as buffer
   */
  async retrieve(fileName) {
    try {
      const filePath = this.getFilePath(fileName);
      const buffer = await fs.readFile(filePath);

      const stats = await fs.stat(filePath);
      return {
        buffer,
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
      throw new FilesystemError(`Failed to retrieve file: ${error.message}`);
    }
  }

  /**
   * Get a readable stream for a file
   */
  async getStream(fileName) {
    try {
      const filePath = this.getFilePath(fileName);

      // Check if file exists
      await fs.access(filePath);

      const stream = createReadStream(filePath);
      const stats = await fs.stat(filePath);

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
      throw new FilesystemError(`Failed to delete file: ${error.message}`);
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
    } catch (error) {
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
      throw new FilesystemError(
        `Failed to get file metadata: ${error.message}`,
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
        if (options.filesOnly && !file.isFile()) continue;
        if (options.directoriesOnly && !file.isDirectory()) continue;

        const filePath = path.join(dirPath, file.name);
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

        // Recursive listing if requested
        if (options.recursive && file.isDirectory()) {
          const subFiles = await this.list(filePath, options);
          results.push(...subFiles);
        }
      }

      return results;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new FilesystemError(`Directory not found: ${directory}`);
      }
      throw new FilesystemError(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Copy a file
   */
  async copy(sourceFileName, destinationFileName) {
    try {
      const sourcePath = this.getFilePath(sourceFileName);
      const destPath = this.getFilePath(destinationFileName);

      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await this.ensureDir(destDir);

      await fs.copyFile(sourcePath, destPath);

      const stats = await fs.stat(destPath);
      return {
        sourceFileName,
        destinationFileName,
        size: stats.size,
        createdAt: stats.birthtime,
        provider: 'local',
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new FilesystemError(`Source file not found: ${sourceFileName}`);
      }
      throw new FilesystemError(`Failed to copy file: ${error.message}`);
    }
  }

  /**
   * Move/rename a file
   */
  async move(sourceFileName, destinationFileName) {
    try {
      const sourcePath = this.getFilePath(sourceFileName);
      const destPath = this.getFilePath(destinationFileName);

      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await this.ensureDir(destDir);

      await fs.rename(sourcePath, destPath);

      const stats = await fs.stat(destPath);
      return {
        sourceFileName,
        destinationFileName,
        size: stats.size,
        modifiedAt: stats.mtime,
        provider: 'local',
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new FilesystemError(`Source file not found: ${sourceFileName}`);
      }
      throw new FilesystemError(`Failed to move file: ${error.message}`);
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
