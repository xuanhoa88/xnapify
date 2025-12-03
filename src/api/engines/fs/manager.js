/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { LocalFilesystemProvider } from './providers/local';
import { MemoryFilesystemProvider } from './providers/memory';

/**
 * Filesystem Manager
 *
 * Manages multiple filesystem providers and provides a unified interface.
 * Supports multiple storage backends with failover and load balancing.
 */
export class FilesystemManager {
  constructor(config = {}) {
    this.providers = new Map();
    this.defaultProvider = config.defaultProvider || 'local';
    this.config = config;

    // Initialize default providers
    this.initializeDefaultProviders();
  }

  /**
   * Initialize default filesystem providers
   */
  initializeDefaultProviders() {
    // Local filesystem provider
    this.addProvider(
      'local',
      new LocalFilesystemProvider(this.config.local || {}),
    );

    // Memory filesystem provider (for testing)
    this.addProvider(
      'memory',
      new MemoryFilesystemProvider(this.config.memory || {}),
    );
  }

  /**
   * Add a filesystem provider
   */
  addProvider(name, provider) {
    this.providers.set(name, provider);
    return this;
  }

  /**
   * Remove a filesystem provider
   */
  removeProvider(name) {
    if (name === this.defaultProvider) {
      const error = new Error('Cannot remove the default provider');
      error.name = 'InvalidFilesystemProviderNameError';
      error.status = 400;
      throw error;
    }
    return this.providers.delete(name);
  }

  /**
   * Get a filesystem provider
   */
  getProvider(name = null) {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      const error = new Error(`Filesystem provider not found: ${providerName}`);
      error.name = 'FilesystemProviderNotFoundError';
      error.status = 404;
      throw error;
    }

    return provider;
  }

  /**
   * List available providers
   */
  listProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Set default provider
   */
  setDefaultProvider(name) {
    if (!this.providers.has(name)) {
      const error = new Error(`Filesystem provider not found: ${name}`);
      error.name = 'FilesystemProviderNotFoundError';
      error.status = 404;
      throw error;
    }
    this.defaultProvider = name;
    return this;
  }

  /**
   * Store a file using specified or default provider
   */
  async store(fileName, fileBuffer, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.store(fileName, fileBuffer, options);
  }

  /**
   * Store a file from stream using specified or default provider
   */
  async storeStream(fileName, readableStream, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.storeStream(fileName, readableStream, options);
  }

  /**
   * Retrieve a file using specified or default provider
   */
  async retrieve(fileName, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.retrieve(fileName);
  }

  /**
   * Get a file stream using specified or default provider
   */
  async getStream(fileName, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.getStream(fileName);
  }

  /**
   * Delete a file using specified or default provider
   */
  async delete(fileName, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.delete(fileName);
  }

  /**
   * Check if file exists using specified or default provider
   */
  async exists(fileName, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.exists(fileName);
  }

  /**
   * Get file metadata using specified or default provider
   */
  async getMetadata(fileName, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.getMetadata(fileName);
  }

  /**
   * List files using specified or default provider
   */
  async list(directory = '', options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.list(directory, options);
  }

  /**
   * Copy a file using specified or default provider
   */
  async copy(sourceFileName, destinationFileName, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.copy(sourceFileName, destinationFileName);
  }

  /**
   * Move a file using specified or default provider
   */
  async move(sourceFileName, destinationFileName, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.move(sourceFileName, destinationFileName);
  }

  /**
   * Copy file between providers
   */
  async copyBetweenProviders(
    fileName,
    sourceProvider,
    destinationProvider,
    options = {},
  ) {
    try {
      const source = this.getProvider(sourceProvider);
      const destination = this.getProvider(destinationProvider);

      // Get file from source
      const { buffer, metadata } = await source.retrieve(fileName);

      // Store in destination
      const newFileName = options.destinationFileName || fileName;
      const result = await destination.store(newFileName, buffer, {
        mimeType: metadata.mimeType,
        ...options,
      });

      return {
        sourceProvider,
        destinationProvider,
        sourceFileName: fileName,
        destinationFileName: newFileName,
        size: result.size,
        success: true,
      };
    } catch (error) {
      error.name = 'FilesystemProviderCopyBetweenProvidersError';
      error.status = 500;
      throw error;
    }
  }

  /**
   * Move file between providers
   */
  async moveBetweenProviders(
    fileName,
    sourceProvider,
    destinationProvider,
    options = {},
  ) {
    try {
      // Copy to destination
      const copyResult = await this.copyBetweenProviders(
        fileName,
        sourceProvider,
        destinationProvider,
        options,
      );

      // Delete from source
      const source = this.getProvider(sourceProvider);
      await source.delete(fileName);

      return {
        ...copyResult,
        moved: true,
      };
    } catch (error) {
      error.name = 'FilesystemProviderMoveBetweenProvidersError';
      error.status = 500;
      throw error;
    }
  }

  /**
   * Get storage statistics for all providers
   */
  async getStats() {
    const stats = {};

    for (const [name, provider] of this.providers.entries()) {
      try {
        stats[name] = await provider.getStats();
      } catch (error) {
        stats[name] = {
          provider: name,
          error: error.message,
        };
      }
    }

    return {
      defaultProvider: this.defaultProvider,
      providers: stats,
      totalProviders: this.providers.size,
    };
  }

  /**
   * Health check for all providers
   */
  async healthCheck() {
    const results = {};

    for (const [name, provider] of this.providers.entries()) {
      try {
        // Try to perform a basic operation
        if (provider.getStats) {
          await provider.getStats();
          results[name] = { status: 'healthy', provider: name };
        } else {
          results[name] = {
            status: 'unknown',
            provider: name,
            message: 'No health check method',
          };
        }
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          provider: name,
          error: error.message,
        };
      }
    }

    const healthyCount = Object.values(results).filter(
      r => r.status === 'healthy',
    ).length;

    return {
      overall: healthyCount === this.providers.size ? 'healthy' : 'degraded',
      providers: results,
      healthyProviders: healthyCount,
      totalProviders: this.providers.size,
      timestamp: new Date().toISOString(),
    };
  }
}
