/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { encryptPluginId, decryptPluginId } from '../utils/crypto';
import { logPluginActivity } from '../utils/activity';

// Get plugin path from environment variable or use default
const PLUGIN_PATH = process.env.RSK_PLUGIN_PATH || 'plugins';
const DEV_PLUGIN_PATH = process.env.RSK_LOCAL_PLUGIN_PATH || 'plugins';

// Cache for plugin list

const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Get plugins directory path
 * @param {string} cwd - Current working directory
 * @returns {string} Plugins directory path
 */
function getPluginsDir(cwd, pluginPath = PLUGIN_PATH) {
  return path.resolve(cwd || process.cwd(), pluginPath);
}

/**
 * Invalidate plugin list cache
 * @param {object} cache - Cache engine instance
 */
async function invalidateCache(cache) {
  if (cache) {
    if (cache) {
      await cache.delete('plugins:list:all');
    }
  }
}

/**
 * Scan a directory and add plugins to the map
 * @param {string} dirPath - Directory path
 * @param {string} source - Source of plugins
 * @param {Map} fsPluginsMap - Map to store plugins
 */
const scanDirectory = async (dirPath, source, fsPluginsMap) => {
  try {
    if (!fs.existsSync(dirPath)) {
      console.debug(`[managePlugins] ${source} dir not found: ${dirPath}`);
      return;
    }
    const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
    console.debug(
      `[managePlugins] Found ${files.length} items in ${source} dir: ${dirPath}`,
    );
    for (const dirent of files) {
      if (dirent.isDirectory()) {
        console.debug(
          `[managePlugins] Scanning plugin: ${dirent.name} (${source})`,
        );
        const manifest = await readPluginManifest(dirPath, dirent.name);
        if (manifest) {
          console.debug(`[managePlugins] Added plugin: ${dirent.name}`);
          // Use directory name as ID for local plugins to keep it simple, or encrypt it
          // For consistency, we use the same encryption.
          // CAUTION: If a plugin exists in both, the last one scanned wins in the map.
          // We should probably prioritize local plugins (dev) over installed ones?
          // Or just treat them as unique based on directory name.

          const encryptedId = encryptPluginId(dirent.name);
          fsPluginsMap.set(dirent.name, {
            ...manifest,
            id: encryptedId,
            internalId: dirent.name,
            isInstalled: false, // Default, will be overwritten by DB check
            source, // 'fs' or 'local'
            isLocal: source === 'local',
          });
        }
      }
    }
  } catch (err) {
    console.warn(`Failed to scan plugins dir: ${dirPath}`, err.message);
  }
};

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
 * Get all plugins (Admin) - Merged from DB and FS
 * @param {object} options - Options with models, cwd
 * @param {object} options.models - Models instance
 * @param {string} options.cwd - Current working directory
 * @returns {Promise<Array>} Array of plugin objects
 */
export async function managePlugins({ models, cwd }) {
  const installedPluginsDir = getPluginsDir(cwd, PLUGIN_PATH);
  const localPluginsDir = getPluginsDir(cwd, DEV_PLUGIN_PATH);

  const { Plugin } = models;

  const plugins = [];
  const fsPluginsMap = new Map();

  // 1. Scan File Systems (FS & Local)
  // This populates fsPluginsMap with what's physically available
  await scanDirectory(installedPluginsDir, 'fs', fsPluginsMap);
  await scanDirectory(localPluginsDir, 'local', fsPluginsMap);

  // 2. Fetch from DB
  const dbPlugins = await Plugin.findAll();
  const dbPluginsMap = new Map();
  dbPlugins.forEach(p => dbPluginsMap.set(p.key, p));

  // 2a. Process DB plugins
  for (const dbPlugin of dbPlugins) {
    const fsPlugin = fsPluginsMap.get(dbPlugin.key);

    if (fsPlugin) {
      // Plugin exists in both DB and FS
      // Merge DB data into FS data. DB is the source of truth for status.
      fsPluginsMap.set(dbPlugin.key, {
        ...fsPlugin,
        ...dbPlugin.toJSON(),
        id: dbPlugin.id,
        dbId: dbPlugin.id,
        isActive: dbPlugin.is_active,
        isInstalled: true,
        source: 'db+fs',
        isMissing: false,
      });
    } else {
      // Plugin in DB but not on disk (Missing)
      plugins.push({
        ...dbPlugin.toJSON(),
        id: dbPlugin.id,
        isMissing: true,
        source: 'db',
        isActive: false,
      });
    }
  }

  // 2b. Process new plugins on disk (Not in DB)
  for (const [key, fsPlugin] of fsPluginsMap.entries()) {
    if (!dbPluginsMap.has(key)) {
      fsPluginsMap.set(key, {
        ...fsPlugin,
        isInstalled: false,
        isActive: false,
        source: fsPlugin.source,
        isMissing: false,
      });
    }
  }

  // Convert Map to Array
  plugins.push(...fsPluginsMap.values());

  console.debug(`[managePlugins] Total plugins found: ${plugins.length}`);

  return plugins;
}

/**
 * Get active plugins (Public/Loader)
 * Optimised to only fetch active plugins from DB and verify FS presence.
 * Does NOT scan the entire plugins directory.
 * @param {object} options - Options with models, cache, cwd
 * @param {object} options.models - Models instance
 * @param {object} options.cache - Cache instance
 * @param {string} options.cwd - Current working directory
 * @returns {Promise<Array>} Array of active plugin objects
 */
export async function getActivePlugins({ models, cache, cwd }) {
  const ACTIVE_PLUGINS_CACHE_KEY = 'plugins:list:active';

  // Return cached result if valid
  if (cache) {
    const cached = await cache.get(ACTIVE_PLUGINS_CACHE_KEY);
    if (cached) return cached;
  }

  const { Plugin } = models;
  const installedPluginsDir = getPluginsDir(cwd, PLUGIN_PATH);
  const localPluginsDir = getPluginsDir(cwd, DEV_PLUGIN_PATH);

  // 1. Fetch only active plugins from DB
  const dbPlugins = await Plugin.findAll({
    where: { is_active: true },
  });

  const plugins = [];

  // 2. Process each active plugin
  for (const dbPlugin of dbPlugins) {
    const { key } = dbPlugin;
    let manifest = null;
    let isLocal = false;

    // Check Local first (dev override)
    const localPath = path.join(localPluginsDir, key);
    if (fs.existsSync(localPath)) {
      manifest = await readPluginManifest(localPluginsDir, key);
      isLocal = true;
    }

    // Check Installed if not found locally
    if (!manifest) {
      const installedPath = path.join(installedPluginsDir, key);
      if (fs.existsSync(installedPath)) {
        manifest = await readPluginManifest(installedPluginsDir, key);
      }
    }

    if (manifest) {
      // Plugin is in DB (Active) AND on Disk
      plugins.push({
        ...manifest,
        ...dbPlugin.toJSON(),
        id: dbPlugin.id,
        dbId: dbPlugin.id,
        isActive: true,
        isInstalled: true,
        source: isLocal ? 'local' : 'fs',
        isLocal,
        isMissing: false,
      });
    } else {
      // Logic decision: If active in DB but missing on disk, do we return it?
      // For frontend loader, a missing plugin cannot be loaded.
      // So we skip it.
      // Optionally log a warning.
      console.warn(`Active plugin ${key} missing from disk.`);
    }
  }

  // Update Cache
  if (cache) {
    await cache.set(ACTIVE_PLUGINS_CACHE_KEY, plugins, CACHE_TTL);
  }

  return plugins;
}

/**
 * Create/Import a plugin into the database
 * @param {Object} data - Plugin data
 * @param {Object} context - App context
 */
export async function createPlugin(data, { models, cache, webhook, actorId }) {
  const { Plugin } = models;
  const plugin = await Plugin.create(data);
  if (cache) await invalidateCache(cache);

  await logPluginActivity(webhook, 'created', plugin.id, data, actorId);

  return plugin;
}

/**
 * Update a plugin (Called by Admin UI for metadata updates)
 * @param {string} id - Plugin UUID
 * @param {Object} data - Update data
 * @param {Object} context - App context with webhook and actorId
 */
export async function updatePlugin(
  id,
  data,
  { models, cache, webhook, actorId },
) {
  const { Plugin } = models;
  const plugin = await Plugin.findByPk(id);
  if (!plugin) throw new Error('Plugin not found');

  await plugin.update(data);
  if (cache) await invalidateCache(cache);

  await logPluginActivity(webhook, 'updated', plugin.id, data, actorId);

  return plugin;
}

/**
 * Delete a plugin from database and FS
 * @param {string} id - Plugin UUID
 * @param {Object} context - App context with webhook and actorId
 */
export async function deletePlugin(
  id,
  { models, cache, cwd, webhook, actorId },
) {
  const { Plugin } = models;
  const plugin = await Plugin.findByPk(id);
  if (!plugin) throw new Error('Plugin not found');

  // Delete from FS
  // Start by finding the directory.
  // We need to know if it's installed or local.
  // Actually local plugins shouldn't be deleted via API?
  // Let's assume we can only delete user installed plugins for now or check paths.
  // Current implementation just deletes DB record.
  // User requested "If delete, total remove files and db record".

  const pluginsDir = getPluginsDir(cwd, PLUGIN_PATH);
  const pluginDir = path.join(pluginsDir, plugin.key);

  // Safety check: Don't delete outside plugins dir?
  // fs.remove should handle safety if implemented correctly, but explicit check is good.
  const relative = path.relative(pluginsDir, pluginDir);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    if (fs.existsSync(pluginDir)) {
      await fs.promises.rm(pluginDir, { recursive: true, force: true });
    }
  } else {
    // If it's a local plugin (symlinked or mapped), we shouldn't delete the source?
    // The key might not map to pluginsDir.
    // Let's check where it is.
    // For now, if it is in `src/modules/plugins`, we delete it.
  }

  await plugin.destroy();
  if (cache) await invalidateCache(cache);

  await logPluginActivity(
    webhook,
    'deleted',
    plugin.id,
    { key: plugin.key },
    actorId,
  );

  return true;
}

/**
 * Get plugin by encrypted ID (Legacy/Loader support)
 * @param {object} context - Context with cwd
 * @param {string} encryptedId - Encrypted plugin ID
 * @returns {Promise<Object>} Plugin data with containerName and manifest
 * @throws {Error} If plugin ID is invalid or plugin not found
 */
export async function getPluginById({ cwd }, encryptedId) {
  const pluginsDir = getPluginsDir(cwd, PLUGIN_PATH);

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

  try {
    const assetsPath = path.join(pluginsDir, pluginId, 'plugin.css');
    await fs.access(assetsPath);
    manifest.cssFiles = [path.basename(assetsPath)];
  } catch {
    // plugin.css might not exist if plugin has no CSS or build failed
  }

  return {
    containerName,
    manifest,
    internalId: pluginId,
  };
}

/**
 * Get plugin static files directory path
 * @param {object} context - Context with cwd
 * @param {string} encryptedId - Encrypted plugin ID
 * @returns {string|null} Plugin static files directory path or null if invalid
 */
export function getPluginStaticDir({ cwd }, encryptedId) {
  const pluginsDir = getPluginsDir(cwd, PLUGIN_PATH);

  // Decrypt ID
  const pluginId = decryptPluginId(encryptedId);
  if (!pluginId) {
    return null;
  }

  return path.join(pluginsDir, pluginId);
}

/**
 * Install plugin from uploaded package (zip)
 */
export async function installPluginFromPackage(
  file,
  context, // { models, cache, fs, cwd, webhook, actorId }
) {
  const { models, cache, fs: fsEngine, cwd } = context;
  if (!file || !file.path) {
    throw new Error('No file provided');
  }

  if (!fsEngine || typeof fsEngine.extract !== 'function') {
    throw new Error('FS engine required for installation');
  }

  const { Plugin } = models;
  const tempPath = file.path;
  const pluginsDir = getPluginsDir(cwd, PLUGIN_PATH);
  const tempExtractDir = path.join(
    os.tmpdir(),
    PLUGIN_PATH,
    path.parse(file.originalname).name,
  );

  try {
    // 1. Prepare directories
    if (!fs.existsSync(pluginsDir)) {
      await fs.promises.mkdir(pluginsDir, { recursive: true });
    }

    const tmpDir = path.dirname(tempExtractDir);
    if (!fs.existsSync(tmpDir)) {
      await fs.promises.mkdir(tmpDir, { recursive: true });
    }

    // 2. Extract using Shared FS Engine
    await fsEngine.extract(tempPath, tempExtractDir);

    // 3. Read package.json (manifest)
    let manifestPath = path.join(tempExtractDir, 'package.json');
    let pluginRoot = tempExtractDir;

    if (!fs.existsSync(manifestPath)) {
      const entries = await fs.promises.readdir(tempExtractDir, {
        withFileTypes: true,
      });
      const subdirs = entries.filter(dirent => dirent.isDirectory());
      if (subdirs.length === 1) {
        pluginRoot = path.join(tempExtractDir, subdirs[0].name);
        manifestPath = path.join(pluginRoot, 'package.json');
      }
    }

    if (!fs.existsSync(manifestPath)) {
      throw new Error('Invalid plugin package: package.json not found');
    }

    const manifest = JSON.parse(
      await fs.promises.readFile(manifestPath, 'utf8'),
    );

    // 4. Validate Manifest
    if (!manifest.name || !manifest.version || !manifest.rapid_plugin) {
      throw new Error(
        'Invalid plugin manifest: missing required fields (name, version, rapid_plugin)',
      );
    }
    const pluginKey =
      manifest.rapid_plugin.key ||
      manifest.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // 5. Move to final destination
    const finalPluginDir = path.join(pluginsDir, pluginKey);

    if (fs.existsSync(finalPluginDir)) {
      await fs.promises.rm(finalPluginDir, { recursive: true, force: true });
    }

    await fs.promises.rename(pluginRoot, finalPluginDir);

    // 6. Create/Update DB Record
    const [plugin, created] = await Plugin.findOrCreate({
      where: { key: pluginKey },
      defaults: {
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        is_active: true,
      },
    });

    if (!created) {
      await plugin.update({
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        is_active: true,
      });
    }

    if (cache) await invalidateCache(cache);

    // Log Activity
    // Note: installPluginFromPackage signature needs update currently doesn't accept webhook/actorId
    // We'll update usage in controller
    if (context.webhook) {
      await logPluginActivity(
        context.webhook,
        created ? 'installed' : 'upgraded',
        plugin.id,
        { version: manifest.version },
        context.actorId,
      );
    }
    return plugin;
  } catch (err) {
    console.error('Plugin install error:', err);
    throw err;
  } finally {
    // Cleanup temp
    try {
      if (fs.existsSync(tempExtractDir)) {
        await fs.promises.rm(tempExtractDir, { recursive: true, force: true });
      }

      // Attempt to clean up uploaded file via fs engine if it provides remove
      if (file.fileName && fsEngine && typeof fsEngine.remove === 'function') {
        await fsEngine.remove(file.fileName);
      }
      // Also try to unlink local path if it exists and wasn't removed (fallback)
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath);
      }
    } catch (e) {
      /* ignore */
    }
  }
}

/**
 * Toggle plugin status
 */

export async function togglePluginStatus(
  id,
  isActive,
  { models, cache, webhook, actorId },
) {
  const { Plugin } = models;
  let plugin = await Plugin.findByPk(id);

  if (!plugin) {
    throw new Error('Plugin not found');
  }

  await plugin.update({ is_active: isActive });
  if (cache) await invalidateCache(cache);

  await logPluginActivity(
    webhook,
    'status_changed',
    plugin.id,
    { isActive },
    actorId,
  );

  return plugin;
}
