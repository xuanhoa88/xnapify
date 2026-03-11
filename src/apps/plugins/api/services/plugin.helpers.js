/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { decryptPluginId, encryptPluginId } from '../utils/crypto';

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
export class PluginError extends Error {
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
    return new PluginError(
      detail ? `Plugin not found: ${detail}` : 'Plugin not found',
      'PluginNotFound',
      404,
    );
  }

  static invalidId() {
    return new PluginError('Invalid plugin ID', 'InvalidPluginId', 400);
  }

  static invalidPackage(message) {
    return new PluginError(
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
 *  1. Try `findByPk(id)` — works for installed plugins with UUID.
 *  2. Fall back to `decryptPluginId(id)` → `findOne({ key })`.
 *
 * @param {Object} models - Sequelize models ({ Plugin })
 * @param {string} id - Plugin UUID or encrypted plugin key
 * @param {Object} [options]
 * @param {boolean} [options.required=true] - Throw if not found
 * @returns {Promise<{plugin: Object|null, pluginKey: string|null}>}
 */
export async function resolvePlugin(models, id, { required = true } = {}) {
  const { Plugin } = models;

  // 1. Try DB primary key (UUID)
  let plugin = await Plugin.findByPk(id);
  let pluginKey = plugin ? plugin.key : null;

  // 2. Fall back to encrypted key
  if (!plugin) {
    pluginKey = decryptPluginId(id);
    if (pluginKey) {
      plugin = await Plugin.findOne({ where: { key: pluginKey } });
    }
  }

  if (!plugin && required) {
    throw PluginError.notFound();
  }

  return { plugin, pluginKey };
}

// ========================================================================
// Plugin Directory Resolution (DRY — used by 3 service functions)
// ========================================================================

/**
 * Resolve the physical directory of a plugin on disk.
 * Checks local/dev path first (dev override), then installed/remote path.
 *
 * @param {Object} pluginManager - ServerPluginManager instance
 * @param {string} cwd - Current working directory
 * @param {string} pluginKey - Plugin directory name / key
 * @returns {{ dir: string|null, isDevPlugin: boolean }}
 */
export function resolvePluginDir(pluginManager, cwd, pluginKey) {
  if (!pluginManager || !cwd || !pluginKey)
    return { dir: null, isDevPlugin: false };

  const devBase = pluginManager.getDevPluginPath(cwd);
  const prodBase = pluginManager.getPluginPath();

  if (devBase) {
    const devPath = path.join(devBase, pluginKey);
    if (fs.existsSync(devPath)) {
      return { dir: devPath, isDevPlugin: true };
    }
  }

  if (prodBase) {
    const prodPath = path.join(prodBase, pluginKey);
    if (fs.existsSync(prodPath)) {
      return { dir: prodPath, isDevPlugin: false };
    }
  }

  return { dir: null, isDevPlugin: false };
}

// ========================================================================
// Manifest Validation (DRY — used by 2 service functions)
// ========================================================================

/**
 * Read plugin manifest from directory
 * @param {string} pluginsDir - Plugins directory path
 * @param {string} pluginName - Plugin directory name
 * @returns {Promise<Object|null>} Plugin manifest or null if invalid
 */
export async function readPluginManifest(pluginsDir, pluginName) {
  try {
    const manifestPath = path.join(pluginsDir, pluginName, 'package.json');
    const manifestContent = await fs.promises.readFile(manifestPath, 'utf8');
    return JSON.parse(manifestContent);
  } catch (e) {
    console.debug(
      `[readPluginManifest] Failed to read manifest for ${pluginName}: ${e.message}`,
    );
    return null;
  }
}

/**
 * Validate a parsed plugin manifest (requires name + version).
 *
 * @param {Object} manifest - Parsed package.json content
 * @returns {{ name: string, version: string }} Validated fields
 * @throws {PluginError} If name or version is missing/empty
 */
export function validateManifest(manifest) {
  const name = typeof manifest.name === 'string' ? manifest.name.trim() : '';
  const version =
    typeof manifest.version === 'string' ? manifest.version.trim() : '';

  if (name.length === 0 || version.length === 0) {
    throw PluginError.invalidPackage(
      'Invalid plugin manifest: missing required fields (name, version)',
    );
  }

  return { name, version };
}

/**
 * Validate that a plugin name is safe for use in file paths.
 * Prevents path traversal attacks (e.g. "../../etc").
 *
 * @param {string} pluginName - Plugin name from manifest
 * @param {string} baseDir - Base directory plugins are stored in
 * @throws {PluginError} If the name escapes the base directory
 */
export function validatePluginNameSafe(pluginName, baseDir) {
  const resolved = path.join(baseDir, pluginName);
  const relative = path.relative(baseDir, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw PluginError.invalidPackage(
      `Invalid plugin name "${pluginName}": path traversal detected`,
    );
  }
}

// ========================================================================
// Cache Invalidation
// ========================================================================

/**
 * Invalidate plugin caches
 * @param {object} cache - Cache engine instance
 * @param {string} [pluginId] - Optional plugin ID to invalidate detail cache
 */
export async function invalidateCache(cache, pluginId) {
  if (cache) {
    const keys = ['plugins:list:all', 'plugins:list:active'];
    if (pluginId) keys.push(`plugins:detail:${pluginId}`);
    await Promise.all(keys.map(k => cache.delete(k)));
  }
}

// ========================================================================
// NPM Dependency Helpers
// ========================================================================

/**
 * Install plugin dependencies
 * @param {string} pluginDir - Plugin directory path
 * @param {object} plugin - Plugin object (needs .name for error messages)
 */
export async function installPluginDependencies(pluginDir, plugin) {
  try {
    if (__DEV__) {
      console.log(`[PluginService] Running npm install in ${pluginDir}`);
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
        cwd: pluginDir,
      },
    );
    if (__DEV__) {
      console.log('[PluginService] npm install completed successfully');
    }
  } catch (npmErr) {
    console.error('[PluginService] npm install failed:', npmErr);
    const pluginName = (plugin && plugin.name) || path.basename(pluginDir);
    const err = new Error(
      `Failed to install dependencies for plugin ${pluginName}`,
    );
    err.status = 500;
    throw err;
  }
}

/**
 * Uninstall plugin dependencies
 * @param {string} pluginDir - Plugin directory path
 * @param {object} plugin - Plugin object (needs .name for error messages)
 */
export async function uninstallPluginDependencies(pluginDir, plugin) {
  try {
    if (__DEV__) {
      console.log(`[PluginService] Running npm uninstall in ${pluginDir}`);
    }
    await execFileAsync('npm', ['uninstall'], {
      cwd: pluginDir,
    });
    if (__DEV__) {
      console.log('[PluginService] npm uninstall completed successfully');
    }
  } catch (npmErr) {
    console.error('[PluginService] npm uninstall failed:', npmErr);
    const pluginName = (plugin && plugin.name) || path.basename(pluginDir);
    const err = new Error(
      `Failed to uninstall dependencies for plugin ${pluginName}`,
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
 * Includes manifest data for PLUGIN_INSTALLED / PLUGIN_UPDATED so the
 * client-side PluginManager can inject CSS/JS tags.
 *
 * @param {Object} app - Express app instance
 * @param {string} type - Event type (PLUGIN_INSTALLED, PLUGIN_UPDATED, PLUGIN_UNINSTALLED, PLUGIN_TAMPERED)
 * @param {string} pluginId - Plugin ID
 */
export function notifyPluginChange(app, type, pluginId) {
  const ws = app.get('ws');
  if (!ws) return;

  const payload = { type, pluginId };

  // Include manifest data for install/update events
  if (type === 'PLUGIN_INSTALLED' || type === 'PLUGIN_UPDATED') {
    const pluginManager = app.get('plugin');
    const metadata = pluginManager
      ? pluginManager.getPluginMetadata(pluginId)
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

  ws.sendToPublicChannel('plugin:updated', payload);
}

// Re-export crypto utils for convenience
export { encryptPluginId, decryptPluginId };
