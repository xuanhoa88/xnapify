/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { decryptExtensionId, encryptExtensionId } from '../utils/crypto';

// Promisify execFile
const execFileAsync = promisify(execFile);

// Cache for plugin list
export const CACHE_TTL = 60 * 1000; // 1 minute

// ========================================================================
// Plugin Error
// ========================================================================

/**
 * Custom error class for plugin operations.
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
      'PluginNotFound',
      404,
    );
  }

  static invalidId() {
    return new ExtensionError('Invalid plugin ID', 'InvalidPluginId', 400);
  }

  static invalidPackage(message) {
    return new ExtensionError(
      message || 'Invalid plugin package',
      'InvalidPluginPackage',
      400,
    );
  }
}

// ========================================================================
// Plugin Error
// ========================================================================

// ========================================================================
// Plugin Resolution (DRY — used by 4 service functions)
// ========================================================================

/**
 * Resolve a plugin record from a mixed ID (DB UUID or encrypted key).
 *
 * Lookup order:
 *  1. Try `findByPk(id)` — works for installed extensions with UUID.
 *  2. Fall back to `decryptExtensionId(id)` → `findOne({ key })`.
 *
 * @param {Object} models - Sequelize models ({ Extension })
 * @param {string} id - Extension UUID or encrypted extension key
 * @param {Object} [options]
 * @param {boolean} [options.required=true] - Throw if not found
 * @returns {Promise<{plugin: Object|null, extensionKey: string|null}>}
 */
export async function resolveExtension(models, id, { required = true } = {}) {
  const { Extension } = models;

  // 1. Try DB primary key (UUID)
  let plugin = await Extension.findByPk(id);
  let extensionKey = plugin ? plugin.key : null;

  // 2. Fall back to encrypted key
  if (!plugin) {
    extensionKey = decryptExtensionId(id);
    if (extensionKey) {
      plugin = await Extension.findOne({ where: { key: extensionKey } });
    }
  }

  if (!plugin && required) {
    throw ExtensionError.notFound();
  }

  return { plugin, extensionKey };
}

/**
 * Resolve the physical directory of a plugin on disk.
 *
 * Delegates to `extensionManager.resolveExtensionDir()` as the single source
 * of truth for dev/prod path resolution. Falls back to manual resolution
 * when the method is unavailable (backward compatibility).
 *
 * @param {Object} extensionManager - ServerExtensionManager instance
 * @param {string} cwd - Current working directory (unused when delegating)
 * @param {string} extensionKey - Plugin directory name / key
 * @returns {{ dir: string|null, isDevExtension: boolean }}
 */
export function resolveExtensionDir(extensionManager, cwd, extensionKey) {
  if (!extensionManager || !extensionKey) return { dir: null, isDevExtension: false };

  // Delegate to extensionManager's canonical implementation
  if (typeof extensionManager.resolveExtensionDir === 'function') {
    return extensionManager.resolveExtensionDir(extensionKey);
  }

  // Fallback for backward compatibility
  const devBase = extensionManager.getDevExtensionPath(cwd);
  const prodBase = extensionManager.getExtensionPath();

  if (devBase) {
    const devPath = path.join(devBase, extensionKey);
    if (fs.existsSync(devPath)) {
      return { dir: devPath, isDevExtension: true };
    }
  }

  if (prodBase) {
    const prodPath = path.join(prodBase, extensionKey);
    if (fs.existsSync(prodPath)) {
      return { dir: prodPath, isDevExtension: false };
    }
  }

  return { dir: null, isDevExtension: false };
}

// ========================================================================
// Manifest Validation (DRY — used by 2 service functions)
// ========================================================================

/**
 * Read plugin manifest from directory
 * @param {string} extensionsDir - Plugins directory path
 * @param {string} extensionName - Plugin directory name
 * @returns {Promise<Object|null>} Plugin manifest or null if invalid
 */
export async function readExtensionManifest(extensionsDir, extensionName) {
  try {
    const manifestPath = path.join(extensionsDir, extensionName, 'package.json');
    const manifestContent = await fs.promises.readFile(manifestPath, 'utf8');
    return JSON.parse(manifestContent);
  } catch (e) {
    console.debug(
      `[readExtensionManifest] Failed to read manifest for ${extensionName}: ${e.message}`,
    );
    return null;
  }
}

/**
 * Validate a parsed plugin manifest (requires name + version).
 *
 * @param {Object} manifest - Parsed package.json content
 * @returns {{ name: string, version: string }} Validated fields
 * @throws {ExtensionError} If name or version is missing/empty
 */
export function validateManifest(manifest) {
  const name = typeof manifest.name === 'string' ? manifest.name.trim() : '';
  const version =
    typeof manifest.version === 'string' ? manifest.version.trim() : '';

  if (name.length === 0 || version.length === 0) {
    throw ExtensionError.invalidPackage(
      'Invalid plugin manifest: missing required fields (name, version)',
    );
  }

  return { name, version };
}

/**
 * Validate that a plugin name is safe for use in file paths.
 * Prevents path traversal attacks (e.g. "../../etc").
 *
 * @param {string} extensionName - Extension name from manifest
 * @param {string} baseDir - Base directory plugins are stored in
 * @throws {ExtensionError} If the name escapes the base directory
 */
export function validateExtensionNameSafe(extensionName, baseDir) {
  const resolved = path.join(baseDir, extensionName);
  const relative = path.relative(baseDir, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw ExtensionError.invalidPackage(
      `Invalid plugin name "${extensionName}": path traversal detected`,
    );
  }
}

// ========================================================================
// Cache Invalidation
// ========================================================================

/**
 * Invalidate plugin caches
 * @param {object} cache - Cache engine instance
 * @param {string} [extensionId] - Optional plugin ID to invalidate detail cache
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
 * Install plugin dependencies
 * @param {string} extensionDir - Plugin directory path
 * @param {object} plugin - Plugin object (needs .name for error messages)
 */
export async function installExtensionDependencies(extensionDir, plugin) {
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
    const extensionName = (plugin && plugin.name) || path.basename(extensionDir);
    const err = new Error(
      `Failed to install dependencies for plugin ${extensionName}`,
    );
    err.status = 500;
    throw err;
  }
}

// ========================================================================
// WebSocket Notification Helper
// ========================================================================

/**
 * Send a plugin change notification over WebSocket.
 * Includes manifest data for EXTENSION_INSTALLED / EXTENSION_UPDATED so the
 * client-side PluginManager can inject CSS/JS tags.
 *
 * @param {Object} container - DI container instance
 * @param {string} type - Event type (EXTENSION_INSTALLED, EXTENSION_UPDATED, PLUGIN_UNINSTALLED, PLUGIN_TAMPERED)
 * @param {string} extensionId - Plugin ID
 */
export function notifyExtensionChange(container, type, extensionId) {
  const ws = container.resolve('ws');
  if (!ws) return;

  const payload = { type, extensionId };

  // Include manifest data for install/update events
  if (type === 'EXTENSION_INSTALLED' || type === 'EXTENSION_UPDATED') {
    const extensionManager = container.resolve('extension');
    const metadata = extensionManager
      ? extensionManager.getExtensionMetadata(extensionId)
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

// Re-export crypto utils for convenience
export { encryptExtensionId, decryptExtensionId };
