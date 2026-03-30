/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createUploadMiddleware, MIDDLEWARES } from './middlewares';
import { LocalFilesystemProvider } from './providers/local';
import { MemoryFilesystemProvider } from './providers/memory';
import { SelfHostFilesystemProvider } from './providers/selfhost';
import {
  upload as uploadService,
  download as downloadService,
  remove as removeService,
  copy as copyService,
  rename as renameService,
  info as infoService,
  preview as previewService,
  sync as syncService,
  extract as extractService,
} from './services';
import { FilesystemError } from './utils';

/**
 * Filesystem Manager
 *
 * Manages multiple filesystem providers and provides a unified interface.
 * Supports upload, download, delete, copy, rename, info, preview, and sync operations.
 */
class FilesystemManager {
  constructor(config = {}) {
    this.providers = new Map();
    this.defaultProvider = config.provider || 'local';
    this.config = config;

    // Initialize default providers
    this.initializeDefaultProviders();
  }

  /**
   * Initialize default filesystem providers
   * @private
   */
  initializeDefaultProviders() {
    // Local filesystem provider
    this.providers.set(
      'local',
      new LocalFilesystemProvider(this.config.local || {}),
    );

    // Memory filesystem provider (for testing)
    this.providers.set(
      'memory',
      new MemoryFilesystemProvider(this.config.memory || {}),
    );

    // Self-host filesystem provider (when configured)
    if (this.config.selfhost && this.config.selfhost.baseUrl) {
      this.providers.set(
        'selfhost',
        new SelfHostFilesystemProvider(this.config.selfhost),
      );
    }
  }

  /**
   * Add a custom provider (cannot override existing)
   * @param {string} name - Provider name
   * @param {Object} provider - Provider instance
   * @returns {boolean} True if added, false if already exists
   */
  addProvider(name, provider) {
    if (this.providers.has(name)) {
      console.warn(
        `⚠️ Filesystem provider "${name}" already exists. Cannot override.`,
      );
      return false;
    }
    this.providers.set(name, provider);
    console.info(`✅ Registered filesystem provider: ${name}`);
    return true;
  }

  /**
   * Get a filesystem provider
   * @param {string} name - Provider name (optional, uses default if not specified)
   * @returns {Object} Provider instance
   */
  getProvider(name = null) {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new FilesystemError(
        `Filesystem provider not found: ${providerName}`,
        'PROVIDER_NOT_FOUND',
        404,
      );
    }

    return provider;
  }

  /**
   * Get list of registered provider names
   * @returns {Array<string>} Array of provider names
   */
  getProviderNames() {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if provider exists
   * @param {string} name - Provider name
   * @returns {boolean} True if provider exists
   */
  hasProvider(name) {
    return this.providers.has(name);
  }

  /**
   * Get statistics from all providers
   * @returns {Object} Stats object keyed by provider name
   */
  getAllStats() {
    const stats = {};
    for (const [name, provider] of this.providers) {
      try {
        if (provider.getStats && typeof provider.getStats === 'function') {
          stats[name] = provider.getStats();
        } else {
          stats[name] = { available: false };
        }
      } catch (error) {
        stats[name] = { error: error.message };
      }
    }
    return stats;
  }

  /**
   * Cleanup - close all providers
   * Called automatically on process termination
   * @returns {Promise<void>}
   */
  async cleanup() {
    console.info('🧹 Cleaning up filesystem engine...');

    for (const [name, provider] of this.providers) {
      try {
        if (provider.close && typeof provider.close === 'function') {
          await provider.close();
          console.info(`✅ Closed filesystem provider: ${name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to close provider ${name}:`, error.message);
      }
    }

    this.providers.clear();
    console.info('✅ Filesystem engine cleanup complete');
  }

  // =============================================================================
  // OPERATIONS (delegated to separate files)
  // =============================================================================

  async upload(files, options = {}) {
    return uploadService(this, files, options);
  }

  async download(fileNames, options = {}) {
    return downloadService(this, fileNames, options);
  }

  async remove(fileNames, options = {}) {
    return removeService(this, fileNames, options);
  }

  async copy(ops, options = {}) {
    return copyService(this, ops, options);
  }

  async rename(ops, options = {}) {
    return renameService(this, ops, options);
  }

  async info(fileName, options = {}) {
    return infoService(this, fileName, options);
  }

  async preview(fileName, options = {}) {
    return previewService(this, fileName, options);
  }

  async sync(ops, options = {}) {
    return syncService(this, ops, options);
  }

  async extract(zipSource, extractPath, options = {}) {
    return extractService(this, zipSource, extractPath, options);
  }

  // =============================================================================
  // MIDDLEWARE HELPERS
  // =============================================================================

  /**
   * Create upload middleware for Express routes
   * @param {Object} options - Multer options (fieldName, maxFiles, maxFileSize, allowedMimeTypes, provider)
   * @returns {Function} Express middleware
   */
  useUploadMiddleware(options = {}) {
    const provider = this.getProvider(options.provider);
    return createUploadMiddleware(provider, options);
  }

  // =============================================================================
  // LOW-LEVEL PROVIDER METHODS
  // =============================================================================

  async exists(fileName, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.exists(fileName);
  }

  async getMetadata(fileName, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.getMetadata(fileName);
  }

  async list(directory = '', options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.list(directory, options);
  }
}

/**
 * Create a new isolated FilesystemManager instance
 * Useful for testing or isolated filesystem contexts
 *
 * @param {Object} config - Filesystem manager configuration
 * @param {string} [config.provider='local'] - Default provider
 * @param {Object} [config.local] - Local filesystem configuration
 * @param {Object} [config.memory] - Memory provider configuration
 * @param {Object} [config.selfhost] - Self-host provider configuration
 * @returns {FilesystemManager} New manager instance
 */
export function createFactory(config = {}) {
  const instance = new FilesystemManager(config);
  instance.MIDDLEWARES = MIDDLEWARES;

  // Register cleanup with global coordinator

  return instance;
}
