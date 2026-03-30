/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';

// Promisify execFile
const execFileAsync = promisify(execFile);

// Cache for extension list
export const CACHE_TTL = 60 * 1000; // 1 minute

// ========================================================================
// Extension Error
// ========================================================================

/**
 * Custom error class for extension operations.
 * Provides typed factory methods for consistent error handling.
 */
export class ExtensionError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} name - Error name/type
   * @param {number} status - HTTP status code
   */
  constructor(message, name, status) {
    super(message);
    this.name = name;
    this.status = status;
  }

  static notFound(detail = '') {
    return new ExtensionError(
      detail ? `Extension not found: ${detail}` : 'Extension not found',
      'ExtensionNotFound',
      404,
    );
  }

  static invalidId() {
    return new ExtensionError(
      'Invalid extension ID',
      'InvalidExtensionId',
      400,
    );
  }

  static invalidPackage(message) {
    return new ExtensionError(
      message || 'Invalid extension package',
      'InvalidExtensionPackage',
      400,
    );
  }

  static conflict(message) {
    return new ExtensionError(
      message || 'Extension already exists',
      'ExtensionConflict',
      409,
    );
  }
}

// ========================================================================
// Extension Resolution (DRY — used by 4 service functions)
// ========================================================================
/**
 * Resolve an extension record by its canonical key (manifest.id = DB `key`).
 *
 * @param {Object} models - Sequelize models ({ Extension })
 * @param {string} id - Extension key (manifest.id)
 * @param {Object} [options]
 * @param {boolean} [options.required=true] - Throw if not found
 * @returns {Promise<{extension: Object|null}>}
 */
export async function resolveExtension(models, id, { required = true } = {}) {
  const { Extension } = models;

  const extension = await Extension.findOne({ where: { key: id } });

  if (!extension && required) {
    throw ExtensionError.notFound();
  }

  return { extension };
}

// ========================================================================

// ========================================================================
// Manifest Validation (DRY — used by 2 service functions)
// ========================================================================

/**
 * Validate a parsed extension manifest (requires name + version).
 *
 * @param {Object} manifest - Parsed package.json content
 * @returns {{ name: string, version: string }} Validated fields
 * @throws {ExtensionError} If name or version is missing/empty
 */
export function validateManifest(manifest) {
  const name =
    (typeof manifest.name === 'string' && manifest.name.trim()) || '';
  const version =
    (typeof manifest.version === 'string' && manifest.version.trim()) ||
    '0.0.0';
  if (name.length === 0 || version.length === 0) {
    throw ExtensionError.invalidPackage(
      'Invalid extension manifest: missing required fields (name, version)',
    );
  }

  return { name, version };
}

// ========================================================================
// Cache Invalidation
// ========================================================================

/**
 * Invalidate extension caches
 * @param {object} cache - Cache engine instance
 * @param {string} [extensionId] - Optional extension ID to invalidate detail cache
 */
export async function invalidateCache(cache, extensionId) {
  if (cache) {
    const keys = ['extensions:list:all', 'extensions:list:active'];
    if (extensionId) keys.push(`extensions:detail:${extensionId}`);
    await Promise.all(keys.map(k => cache.delete(k)));
  }
}

// ========================================================================
// NPM Dependency Helpers
// ========================================================================

/**
 * Install extension dependencies
 * @param {string} extensionDir - Extension directory path
 * @param {object} extension - Extension object (needs .name for error messages)
 */
export async function installExtensionDependencies(extensionDir, extension) {
  try {
    if (__DEV__) {
      console.log(`[ExtensionService] Running npm install in ${extensionDir}`);
    }
    await execFileAsync(
      'npm',
      [
        'install',
        '--no-audit',
        '--no-update-notifier',
        '--no-fund',
        '--production',
        '--engine-strict',
        '--no-package-lock',
      ],
      {
        cwd: extensionDir,
      },
    );
    if (__DEV__) {
      console.log('[ExtensionService] npm install completed successfully');
    }
  } catch (npmErr) {
    console.error('[ExtensionService] npm install failed:', npmErr);
    const extensionName =
      (extension && extension.name) || path.basename(extensionDir);
    const err = new Error(
      `Failed to install dependencies for extension ${extensionName}`,
    );
    err.status = 500;
    throw err;
  }
}

// ========================================================================
// WebSocket Notification Helper
// ========================================================================

/**
 * Send a extension change notification over WebSocket.
 * Includes manifest data for EXTENSION_INSTALLED / EXTENSION_UPDATED so the
 * client-side extensionManager can inject CSS/JS tags.
 *
 * @param {Object} container - DI container instance
 * @param {string} type - Event type (EXTENSION_INSTALLED, EXTENSION_UPDATED, EXTENSION_UNINSTALLED, EXTENSION_TAMPERED)
 * @param {string} extensionKey - Extension manifest name (canonical key)
 * @param {string} [extensionId] - Optional DB UUID (for manifest lookup)
 */
export function notifyExtensionChange(container, type, extensionKey) {
  const ws = container.resolve('ws');
  if (!ws) return;

  // Use extensionKey (manifest.id) as the canonical identifier
  const payload = { type, extensionId: extensionKey };

  // Include manifest data for install/update/activate events
  if (
    type === 'EXTENSION_INSTALLED' ||
    type === 'EXTENSION_UPDATED' ||
    type === 'EXTENSION_ACTIVATED'
  ) {
    const extensionManager = container.resolve('extension');
    const metadata = extensionManager
      ? extensionManager.getExtensionMetadata(extensionKey)
      : null;
    payload.data = {
      manifest:
        metadata && metadata.manifest
          ? {
              hasClientCss: metadata.manifest.hasClientCss || false,
              hasClientScript: metadata.manifest.hasClientScript || false,
              version: metadata.manifest.version || '0.0.0',
            }
          : null,
    };
  }

  ws.sendToPublicChannel('extension:updated', payload);
}
