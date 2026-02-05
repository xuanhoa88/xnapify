/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs/promises';
import path from 'path';
import { encryptPluginId, decryptPluginId } from '../utils/crypto';

/**
 * Get plugins directory path
 * @param {object} app - Express app instance
 * @returns {string} Plugins directory path
 */
export function getPluginsDir(app) {
  return path.resolve(
    app.get('cwd') || process.cwd(),
    process.env.RSK_PLUGIN_PATH || 'plugins',
  );
}

/**
 * Read plugin manifest from directory
 * @param {string} pluginsDir - Plugins directory path
 * @param {string} pluginName - Plugin directory name
 * @returns {Promise<Object|null>} Plugin manifest or null if invalid
 */
export async function readPluginManifest(pluginsDir, pluginName) {
  try {
    const manifestPath = path.join(pluginsDir, pluginName, 'package.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    return JSON.parse(manifestContent);
  } catch (e) {
    return null;
  }
}

/**
 * List all available plugins
 * @param {object} app - Express app instance
 * @returns {Promise<Array>} Array of plugin objects with encrypted IDs
 */
export async function listAllPlugins(app) {
  const plugins = [];
  const pluginsDir = getPluginsDir(app);

  try {
    const files = await fs.readdir(pluginsDir, { withFileTypes: true });

    for (const dirent of files) {
      if (dirent.isDirectory()) {
        const manifest = await readPluginManifest(pluginsDir, dirent.name);
        if (manifest) {
          plugins.push({
            ...manifest,
            id: encryptPluginId(dirent.name),
          });
        }
      }
    }
  } catch (err) {
    // Return empty array if plugins directory doesn't exist
  }

  return plugins;
}

/**
 * Get plugin by encrypted ID
 * @param {object} app - Express app instance
 * @param {string} encryptedId - Encrypted plugin ID
 * @returns {Promise<Object>} Plugin data with containerName and manifest
 * @throws {Error} If plugin ID is invalid or plugin not found
 */
export async function getPluginById(app, encryptedId) {
  const pluginsDir = getPluginsDir(app);

  // Decrypt ID
  const pluginId = decryptPluginId(encryptedId);
  if (!pluginId) {
    const err = new Error('Invalid plugin ID');
    err.name = 'InvalidPluginId';
    err.status = 400;
    throw err;
  }

  // Read manifest
  const manifest = await readPluginManifest(pluginsDir, pluginId);
  if (!manifest) {
    const err = new Error('Plugin not found');
    err.name = 'PluginNotFound';
    err.status = 404;
    throw err;
  }

  // Create safe container name from plugin ID (must match webpack config)
  const containerName = `plugin_${pluginId.replace(/[^a-zA-Z0-9]/g, '_')}`;

  // Read assets.json to get CSS files
  try {
    const assetsPath = path.join(pluginsDir, pluginId, 'assets.json');
    const assetsData = await fs.readFile(assetsPath, 'utf8');
    const { css: cssFiles } = JSON.parse(assetsData);
    manifest.cssFiles = Array.isArray(cssFiles) ? [...new Set(cssFiles)] : [];
  } catch {
    // assets.json might not exist if plugin has no CSS or build failed
  }

  return {
    containerName,
    manifest,
    internalId: pluginId,
  };
}

/**
 * Get plugin static files directory path
 * @param {object} app - Express app instance
 * @param {string} encryptedId - Encrypted plugin ID
 * @returns {string|null} Plugin static files directory path or null if invalid
 */
export function getPluginStaticDir(app, encryptedId) {
  const pluginsDir = getPluginsDir(app);

  // Decrypt ID
  const pluginId = decryptPluginId(encryptedId);
  if (!pluginId) {
    return null;
  }

  return path.join(pluginsDir, pluginId);
}
