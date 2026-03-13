/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Readable } from 'stream';

import fetch from 'node-fetch';

import { FilesystemError } from '../utils';

/**
 * Self-Host Filesystem Provider
 *
 * Provides file storage operations via HTTP/HTTPS to a self-hosted storage server.
 * Supports file upload, download, deletion, and metadata operations through REST API.
 *
 * All API routes are fully configurable via the `routes` config option.
 */
export class SelfHostFilesystemProvider {
  constructor(config = {}) {
    if (!config.baseUrl) {
      throw new FilesystemError(
        'Self-host provider requires a baseUrl configuration',
      );
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey || null;
    this.timeout = config.timeout || 30 * 1000; // 30 seconds default
    this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB default
    this.allowedExtensions = config.allowedExtensions || null; // null = allow all

    // Fully configurable API routes
    // Each route is a function that receives context and returns { path, method, query?, body? }
    // By default, fileName is passed via query params (not in URL path)
    const defaultRoutes = {
      // Upload file: POST /files?file={fileName}
      upload: ({ fileName }) => ({
        path: '/files',
        method: 'POST',
        query: { file: fileName },
      }),
      // Download file: GET /files?file={fileName}
      download: ({ fileName }) => ({
        path: '/files',
        method: 'GET',
        query: { file: fileName },
      }),
      // Delete file: DELETE /files?file={fileName}
      delete: ({ fileName }) => ({
        path: '/files',
        method: 'DELETE',
        query: { file: fileName },
      }),
      // Check existence: HEAD /files?file={fileName}
      exists: ({ fileName }) => ({
        path: '/files',
        method: 'HEAD',
        query: { file: fileName },
      }),
      // Get metadata: GET /files?file={fileName}&metadata=true
      metadata: ({ fileName }) => ({
        path: '/files',
        method: 'GET',
        query: { file: fileName, metadata: 'true' },
      }),
      // List files: GET /files?directory={path}
      list: ({ directory, recursive, filesOnly, directoriesOnly }) => ({
        path: '/files',
        method: 'GET',
        query: {
          ...(directory && { directory }),
          ...(recursive && { recursive: 'true' }),
          ...(filesOnly && { filesOnly: 'true' }),
          ...(directoriesOnly && { directoriesOnly: 'true' }),
        },
      }),
      // Copy file: POST /files/copy
      copy: ({ sourceFileName, destinationFileName }) => ({
        path: '/files/copy',
        method: 'POST',
        body: { source: sourceFileName, destination: destinationFileName },
      }),
      // Move file: POST /files/move
      move: ({ sourceFileName, destinationFileName }) => ({
        path: '/files/move',
        method: 'POST',
        body: { source: sourceFileName, destination: destinationFileName },
      }),
      // Get stats: GET /stats
      stats: () => ({
        path: '/stats',
        method: 'GET',
      }),
    };

    // Merge user-defined routes with defaults
    this.routes = { ...defaultRoutes, ...config.routes };
  }

  /**
   * Get default headers for requests
   */
  getHeaders(additionalHeaders = {}) {
    const headers = {
      ...additionalHeaders,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Build URL from route definition
   */
  buildUrl(routeName, context = {}) {
    const route = this.routes[routeName];
    if (!route) {
      throw new FilesystemError(`Unknown route: ${routeName}`);
    }

    const { path, query = {} } =
      typeof route === 'function' ? route(context) : route;
    const url = new URL(`${this.baseUrl}${path}`);

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }

  /**
   * Get HTTP method from route definition
   */
  getMethod(routeName, context = {}) {
    const route = this.routes[routeName];
    if (!route) {
      throw new FilesystemError(`Unknown route: ${routeName}`);
    }

    const { method } = typeof route === 'function' ? route(context) : route;
    return method || 'GET';
  }

  /**
   * Get request body from route definition
   */
  getBody(routeName, context = {}) {
    const route = this.routes[routeName];
    if (!route) {
      throw new FilesystemError(`Unknown route: ${routeName}`);
    }

    const { body } = typeof route === 'function' ? route(context) : route;
    return body || {};
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
   * Make HTTP request with timeout
   */
  async makeRequest(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: this.getHeaders(options.headers),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new FilesystemError(
          `HTTP ${response.status}: ${errorText}`,
          'HTTP_ERROR',
          response.status,
        );
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new FilesystemError(`Request timeout after ${this.timeout}ms`);
      }
      if (error instanceof FilesystemError) {
        throw error;
      }
      throw new FilesystemError(`Request failed: ${error.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
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
        const ext = fileName.split('.').pop();
        throw new FilesystemError(`File extension not allowed: .${ext}`);
      }

      // Detect if fileData is a stream (has pipe method and readable property)
      const isStream =
        fileData &&
        typeof fileData.pipe === 'function' &&
        typeof fileData.on === 'function';

      let buffer;
      if (isStream) {
        // Stream mode: collect chunks into buffer (needed for HTTP Content-Length)
        const chunks = [];
        let totalSize = 0;

        for await (const chunk of fileData) {
          totalSize += chunk.length;

          // Check size limit during streaming
          if (totalSize > this.maxFileSize) {
            throw new FilesystemError(
              `File size exceeds limit: ${totalSize} > ${this.maxFileSize}`,
            );
          }

          chunks.push(chunk);
        }

        buffer = Buffer.concat(chunks);
      } else {
        // Buffer mode
        buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData);

        // Validate file size
        if (buffer.length > this.maxFileSize) {
          throw new FilesystemError(
            `File size exceeds limit: ${buffer.length} > ${this.maxFileSize}`,
          );
        }
      }

      const context = { fileName };
      const url = this.buildUrl('upload', context);
      const response = await this.makeRequest(url, {
        method: this.getMethod('upload', context),
        headers: {
          'Content-Type': options.mimeType || 'application/octet-stream',
          'Content-Length': buffer.length.toString(),
        },
        body: buffer,
      });

      const result = await response.json().catch(() => ({}));

      return {
        fileName,
        size: buffer.length,
        mimeType: options.mimeType || 'application/octet-stream',
        createdAt: new Date(),
        provider: 'selfhost',
        ...result,
      };
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw new FilesystemError(`Failed to store file: ${error.message}`);
    }
  }

  /**
   * Get a readable stream for a file
   */
  async retrieve(fileName) {
    try {
      const context = { fileName };
      const url = this.buildUrl('download', context);
      const response = await this.makeRequest(url, {
        method: this.getMethod('download', context),
      });

      // Convert web stream to Node.js readable stream
      const reader = response.body.getReader();
      const stream = new Readable({
        async read() {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
          } else {
            this.push(Buffer.from(value));
          }
        },
      });

      return {
        stream,
        metadata: {
          fileName,
          size: parseInt(response.headers.get('content-length') || '0', 10),
          mimeType:
            response.headers.get('content-type') || 'application/octet-stream',
          provider: 'selfhost',
        },
      };
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw new FilesystemError(`Failed to get file stream: ${error.message}`);
    }
  }

  /**
   * Delete a file
   */
  async delete(fileName) {
    try {
      const context = { fileName };
      const url = this.buildUrl('delete', context);
      await this.makeRequest(url, {
        method: this.getMethod('delete', context),
      });

      return { success: true, fileName, provider: 'selfhost' };
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw new FilesystemError(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   */
  async exists(fileName) {
    try {
      const context = { fileName };
      const url = this.buildUrl('exists', context);
      await this.makeRequest(url, {
        method: this.getMethod('exists', context),
      });
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
      const context = { fileName };
      const url = this.buildUrl('metadata', context);
      const response = await this.makeRequest(url, {
        method: this.getMethod('metadata', context),
      });

      const metadata = await response.json();

      return {
        fileName,
        isFile: true,
        isDirectory: false,
        provider: 'selfhost',
        ...metadata,
      };
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw new FilesystemError(
        `Failed to get file metadata: ${error.message}`,
      );
    }
  }

  /**
   * List files in directory
   */
  async list(directory = '', options = {}) {
    try {
      const context = {
        directory,
        recursive: options.recursive,
        filesOnly: options.filesOnly,
        directoriesOnly: options.directoriesOnly,
      };
      const url = this.buildUrl('list', context);
      const response = await this.makeRequest(url, {
        method: this.getMethod('list', context),
      });

      const result = await response.json();
      const files = Array.isArray(result) ? result : result.files || [];

      return files.map(file => ({
        ...file,
        provider: 'selfhost',
      }));
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw new FilesystemError(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Copy a file
   */
  async copy(sourceFileName, destinationFileName) {
    try {
      const context = { sourceFileName, destinationFileName };
      const url = this.buildUrl('copy', context);
      const routeBody = this.getBody('copy', context);
      const response = await this.makeRequest(url, {
        method: this.getMethod('copy', context),
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(routeBody),
      });

      const result = await response.json().catch(() => ({}));

      return {
        sourceFileName,
        destinationFileName,
        provider: 'selfhost',
        ...result,
      };
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw new FilesystemError(`Failed to copy file: ${error.message}`);
    }
  }

  /**
   * Move/rename a file
   */
  async move(sourceFileName, destinationFileName) {
    try {
      const context = { sourceFileName, destinationFileName };
      const url = this.buildUrl('move', context);
      const routeBody = this.getBody('move', context);
      const response = await this.makeRequest(url, {
        method: this.getMethod('move', context),
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(routeBody),
      });

      const result = await response.json().catch(() => ({}));

      return {
        sourceFileName,
        destinationFileName,
        provider: 'selfhost',
        ...result,
      };
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw new FilesystemError(`Failed to move file: ${error.message}`);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    try {
      const url = this.buildUrl('stats');
      const response = await this.makeRequest(url, {
        method: this.getMethod('stats'),
      });

      const stats = await response.json();

      return {
        provider: 'selfhost',
        baseUrl: this.baseUrl,
        maxFileSize: this.maxFileSize,
        allowedExtensions: this.allowedExtensions,
        timeout: this.timeout,
        ...stats,
      };
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw new FilesystemError(
        `Failed to get storage stats: ${error.message}`,
      );
    }
  }
}
