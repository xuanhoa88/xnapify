/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Derive encryption key from JWT secret for consistent ID obfuscation
const PLUGIN_KEY = crypto
  .createHash('sha256')
  .update(process.env.RSK_JWT_SECRET || 'default-insecure-secret')
  .digest();

/**
 * Get plugins directory
 * @param {object} req - Request object
 * @returns {string} Plugins directory path
 */
function getPluginsDir(req) {
  return path.resolve(
    req.app.get('cwd') || process.cwd(),
    process.env.RSK_PLUGIN_PATH || 'plugins',
  );
}

/**
 * Encrypt plugin ID
 * @param {string} id - Plain plugin ID
 * @returns {string} Encrypted ID (hex)
 */
function encryptPluginId(id) {
  try {
    const cipher = crypto.createCipheriv('aes-256-ecb', PLUGIN_KEY, null);
    let encrypted = cipher.update(id, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('Failed to encrypt plugin ID:', error);
    return id; // Fallback to plain ID on error
  }
}

/**
 * Decrypt plugin ID
 * @param {string} token - Encrypted ID (hex)
 * @returns {string|null} Plain plugin ID or null if invalid
 */
function decryptPluginId(token) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-ecb', PLUGIN_KEY, null);
    let decrypted = decipher.update(token, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.warn('Failed to decrypt plugin ID:', error.message);
    return null;
  }
}

/**
 * List all available plugins
 */
export const listPlugins = async (req, res) => {
  const plugins = [];

  try {
    // Get plugins directory
    const pluginsDir = getPluginsDir(req);

    // Read plugins directory
    const files = await fs.readdir(pluginsDir, { withFileTypes: true });

    for (const dirent of files) {
      if (dirent.isDirectory()) {
        try {
          // Read package.json
          const manifestPath = path.join(
            pluginsDir,
            dirent.name,
            'package.json',
          );
          const manifestContent = await fs.readFile(manifestPath, 'utf8');
          const manifest = JSON.parse(manifestContent);

          plugins.push({
            ...manifest,
            id: encryptPluginId(dirent.name), // Encrypt the directory name (ID)
          });
        } catch (e) {
          // Ignore invalid plugins or plugins without manifest
        }
      }
    }

    res.json({ success: true, data: { plugins } });
  } catch (err) {
    res.json({ success: false, data: { plugins } });
  }
};

/**
 * Get plugin metadata and script URL
 */
export const getPlugin = async (req, res) => {
  try {
    // Get plugins directory
    const pluginsDir = getPluginsDir(req);

    // Decrypt ID
    const pluginId = decryptPluginId(req.params.id);
    if (!pluginId) {
      const err = new Error('Invalid plugin ID');
      err.name = 'InvalidPluginId';
      err.status = 400;
      throw err;
    }

    // Read manifest
    let manifest;
    try {
      // Get manifest path
      const manifestPath = path.join(pluginsDir, pluginId, 'package.json');

      // Read manifest content
      const manifestContent = await fs.readFile(manifestPath, 'utf8');

      // Parse manifest
      manifest = JSON.parse(manifestContent);

      // Verify browser entry exists
      const entryPoint = path.join(pluginsDir, pluginId, manifest.browser);
      console.log(
        `[PluginAPI] Serving client bundle for ${pluginId}: ${entryPoint}`,
      );
      await fs.access(entryPoint);

      // Read the script file
      const code = await fs.readFile(entryPoint, 'utf8');

      // Return plugin metadata AND the code
      // We pass the code directly instead of a URL
      return res.json({
        success: true,
        data: {
          code,
          manifest,
          internalId: pluginId,
        },
      });
    } catch (e) {
      const err = new Error('Plugin not found');
      err.name = 'PluginNotFound';
      err.status = 404;
      throw err;
    }
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  }
};
