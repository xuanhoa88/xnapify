/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Readable } from 'stream';
import { FilesystemError } from '../utils';

/**
 * Memory Filesystem Provider
 *
 * Provides in-memory file storage for testing and development.
 * Files are stored in memory and lost when the process restarts.
 */
export class MemoryFilesystemProvider {
  constructor(config = {}) {
    this.files = new Map(); // fileName -> { buffer, metadata }
    this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB default
    this.allowedExtensions = config.allowedExtensions || null; // null = allow all
    this.maxFiles = config.maxFiles || 1000; // Prevent memory overflow
  }

  /**
   * Validate file extension
   */
  validateExtension(fileName) {
    if (!this.allowedExtensions) return true;

    const ext = fileName.split('.').pop().toLowerCase();
    return this.allowedExtensions.includes(`.${ext}`);
  }

  /**
   * Store a file
   */
  async store(fileName, fileBuffer, options = {}) {
    try {
      // Validate extension
      if (!this.validateExtension(fileName)) {
        const ext = fileName.split('.').pop();
        throw new FilesystemError(`File extension not allowed: .${ext}`);
      }

      // Validate file size
      if (fileBuffer.length > this.maxFileSize) {
        throw new FilesystemError(
          `File size exceeds limit: ${fileBuffer.length} > ${this.maxFileSize}`,
        );
      }

      // Check max files limit
      if (this.files.size >= this.maxFiles && !this.files.has(fileName)) {
        throw new FilesystemError(
          `Maximum number of files reached: ${this.maxFiles}`,
        );
      }

      // Store file in memory
      const now = new Date();
      const metadata = {
        fileName,
        size: fileBuffer.length,
        mimeType: options.mimeType || 'application/octet-stream',
        createdAt: now,
        modifiedAt: now,
        provider: 'memory',
      };

      this.files.set(fileName, {
        buffer: Buffer.from(fileBuffer),
        metadata,
      });

      return metadata;
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
        const ext = fileName.split('.').pop();
        throw new FilesystemError(`File extension not allowed: .${ext}`);
      }

      // Check max files limit
      if (this.files.size >= this.maxFiles && !this.files.has(fileName)) {
        throw new FilesystemError(
          `Maximum number of files reached: ${this.maxFiles}`,
        );
      }

      // Read stream into buffer
      const chunks = [];
      let totalSize = 0;

      for await (const chunk of readableStream) {
        totalSize += chunk.length;

        // Check size limit during streaming
        if (totalSize > this.maxFileSize) {
          throw new FilesystemError(
            `File size exceeds limit: ${totalSize} > ${this.maxFileSize}`,
          );
        }

        chunks.push(chunk);
      }

      const fileBuffer = Buffer.concat(chunks);
      return await this.store(fileName, fileBuffer, options);
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
      const fileData = this.files.get(fileName);

      if (!fileData) {
        throw new FilesystemError(`File not found: ${fileName}`);
      }

      return {
        buffer: fileData.buffer,
        metadata: { ...fileData.metadata },
      };
    } catch (error) {
      throw new FilesystemError(`Failed to retrieve file: ${error.message}`);
    }
  }

  /**
   * Get a readable stream for a file
   */
  async getStream(fileName) {
    try {
      const fileData = this.files.get(fileName);

      if (!fileData) {
        throw new FilesystemError(`File not found: ${fileName}`);
      }

      const stream = Readable.from(fileData.buffer);

      return {
        stream,
        metadata: { ...fileData.metadata },
      };
    } catch (error) {
      throw new FilesystemError(`Failed to get file stream: ${error.message}`);
    }
  }

  /**
   * Delete a file
   */
  async delete(fileName) {
    try {
      if (!this.files.has(fileName)) {
        throw new FilesystemError(`File not found: ${fileName}`);
      }

      this.files.delete(fileName);
      return { success: true, fileName, provider: 'memory' };
    } catch (error) {
      throw new FilesystemError(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   */
  async exists(fileName) {
    return this.files.has(fileName);
  }

  /**
   * Get file metadata
   */
  async getMetadata(fileName) {
    try {
      const fileData = this.files.get(fileName);

      if (!fileData) {
        throw new FilesystemError(`File not found: ${fileName}`);
      }

      return {
        ...fileData.metadata,
        isFile: true,
        isDirectory: false,
      };
    } catch (error) {
      throw new FilesystemError(
        `Failed to get file metadata: ${error.message}`,
      );
    }
  }

  /**
   * List files
   */
  async list(directory = '', options = {}) {
    try {
      const results = [];

      for (const [fileName, fileData] of this.files.entries()) {
        // Simple directory filtering (memory provider doesn't have real directories)
        if (directory && !fileName.startsWith(directory)) continue;

        if (options.filesOnly && !fileData.metadata.isFile !== false) continue;
        if (options.directoriesOnly) continue; // Memory provider has no directories

        results.push({
          name: fileName,
          path: fileName,
          size: fileData.metadata.size,
          isFile: true,
          isDirectory: false,
          createdAt: fileData.metadata.createdAt,
          modifiedAt: fileData.metadata.modifiedAt,
          provider: 'memory',
        });
      }

      return results;
    } catch (error) {
      throw new FilesystemError(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Copy a file
   */
  async copy(sourceFileName, destinationFileName) {
    try {
      const sourceData = this.files.get(sourceFileName);

      if (!sourceData) {
        throw new FilesystemError(`Source file not found: ${sourceFileName}`);
      }

      // Check max files limit
      if (
        this.files.size >= this.maxFiles &&
        !this.files.has(destinationFileName)
      ) {
        throw new FilesystemError(
          `Maximum number of files reached: ${this.maxFiles}`,
        );
      }

      const now = new Date();
      const newMetadata = {
        ...sourceData.metadata,
        fileName: destinationFileName,
        createdAt: now,
        modifiedAt: now,
      };

      this.files.set(destinationFileName, {
        buffer: Buffer.from(sourceData.buffer),
        metadata: newMetadata,
      });

      return {
        sourceFileName,
        destinationFileName,
        size: newMetadata.size,
        createdAt: newMetadata.createdAt,
        provider: 'memory',
      };
    } catch (error) {
      throw new FilesystemError(`Failed to copy file: ${error.message}`);
    }
  }

  /**
   * Move/rename a file
   */
  async move(sourceFileName, destinationFileName) {
    try {
      const sourceData = this.files.get(sourceFileName);

      if (!sourceData) {
        throw new FilesystemError(`Source file not found: ${sourceFileName}`);
      }

      // Check max files limit (only if destination is new)
      if (
        this.files.size >= this.maxFiles &&
        !this.files.has(destinationFileName)
      ) {
        throw new FilesystemError(
          `Maximum number of files reached: ${this.maxFiles}`,
        );
      }

      const now = new Date();
      const newMetadata = {
        ...sourceData.metadata,
        fileName: destinationFileName,
        modifiedAt: now,
      };

      // Move the file
      this.files.set(destinationFileName, {
        buffer: sourceData.buffer,
        metadata: newMetadata,
      });

      this.files.delete(sourceFileName);

      return {
        sourceFileName,
        destinationFileName,
        size: newMetadata.size,
        modifiedAt: newMetadata.modifiedAt,
        provider: 'memory',
      };
    } catch (error) {
      throw new FilesystemError(`Failed to move file: ${error.message}`);
    }
  }

  /**
   * Clear all files (useful for testing)
   */
  async clear() {
    const count = this.files.size;
    this.files.clear();
    return { cleared: count, provider: 'memory' };
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    try {
      let totalSize = 0;
      const files = [];

      for (const [fileName, fileData] of this.files.entries()) {
        totalSize += fileData.metadata.size;
        files.push({
          name: fileName,
          size: fileData.metadata.size,
          createdAt: fileData.metadata.createdAt,
        });
      }

      return {
        provider: 'memory',
        totalFiles: this.files.size,
        totalSize,
        maxFileSize: this.maxFileSize,
        maxFiles: this.maxFiles,
        allowedExtensions: this.allowedExtensions,
        files: files.slice(0, 10), // Show first 10 files
      };
    } catch (error) {
      throw new FilesystemError(
        `Failed to get storage stats: ${error.message}`,
      );
    }
  }
}
