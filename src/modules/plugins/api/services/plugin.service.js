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
 * Invalidate plugin caches
 * @param {object} cache - Cache engine instance
 * @param {string} [pluginId] - Optional plugin ID to invalidate detail cache
 */
async function invalidateCache(cache, pluginId) {
  if (cache) {
    await cache.delete('plugins:list:all');
    await cache.delete('plugins:list:active');
    if (pluginId) {
      await cache.delete(`plugins:detail:${pluginId}`);
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
            source, // 'remote' or 'local'
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

  // 1. Scan File Systems (Remote & Local)
  // This populates fsPluginsMap with what's physically available
  await scanDirectory(installedPluginsDir, 'remote', fsPluginsMap);
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
        source: 'db+remote',
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
        source: isLocal ? 'local' : 'remote',
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
 * Delete (uninstall) a plugin — removes DB record and FS directory.
 *
 * Follows the same lookup pattern as `togglePluginStatus`:
 *  1. Try `findByPk(id)` for installed plugins.
 *  2. Fall back to `decryptPluginId` for FS-only plugins.
 *  3. Unload via `pluginManager` before deletion.
 *  4. Remove files from whichever directory the plugin lives in.
 *
 * @param {string} id - Plugin UUID or encrypted plugin key
 * @param {Object} context - App context
 */
export async function deletePlugin(
  id,
  { models, cache, cwd, pluginManager, webhook, actorId },
) {
  const { Plugin } = models;

  // 1. Resolve plugin record (same pattern as togglePluginStatus)
  let plugin = await Plugin.findByPk(id);

  if (!plugin) {
    const pluginKey = decryptPluginId(id);
    if (pluginKey) {
      plugin = await Plugin.findOne({ where: { key: pluginKey } });
    }
  }

  if (!plugin) {
    throw new Error('Plugin not found');
  }

  // 2. Unload the plugin via PluginManager before deleting files
  if (pluginManager) {
    try {
      if (pluginManager.isPluginLoaded(plugin.id)) {
        await pluginManager.unloadPlugin(plugin.id);
      } else {
        await pluginManager.emit('plugin:unloaded', { id: plugin.id });
      }
    } catch (err) {
      console.warn(
        `[pluginService] Failed to unload plugin ${plugin.id} via PluginManager:`,
        err.message,
      );
    }
  }

  // 3. Delete from FS — check both installed and dev directories
  if (cwd) {
    const dirs = [
      getPluginsDir(cwd, PLUGIN_PATH),
      getPluginsDir(cwd, DEV_PLUGIN_PATH),
    ];

    for (const baseDir of dirs) {
      const pluginDir = path.join(baseDir, plugin.key);
      const relative = path.relative(baseDir, pluginDir);

      // Safety: only delete if the resolved path is inside the base dir
      if (
        relative &&
        !relative.startsWith('..') &&
        !path.isAbsolute(relative)
      ) {
        if (fs.existsSync(pluginDir)) {
          await fs.promises.rm(pluginDir, { recursive: true, force: true });
        }
      }
    }
  }

  // 4. Remove DB record and invalidate cache
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
 * Get plugin by ID (DB UUID or encrypted key)
 * @param {object} context - Context with cwd, models, and cache
 * @param {string} id - Plugin ID (DB UUID or encrypted key)
 * @returns {Promise<Object>} Plugin data with containerName and manifest
 * @throws {Error} If plugin ID is invalid or plugin not found
 */
export async function getPluginById({ cwd, models, cache }, id) {
  const cacheKey = `plugins:detail:${id}`;

  // Return cached result if available
  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const pluginsDir = getPluginsDir(cwd, PLUGIN_PATH);
  const localPluginsDir = getPluginsDir(cwd, DEV_PLUGIN_PATH);

  // Try decrypting as encrypted key first
  let pluginKey = decryptPluginId(id);

  // If decryption failed, it might be a DB UUID
  if (!pluginKey && models) {
    const { Plugin } = models;
    const dbPlugin = await Plugin.findByPk(id);
    if (dbPlugin) {
      pluginKey = dbPlugin.key;
    }
  }

  if (!pluginKey) {
    const err = new Error('Invalid plugin ID');
    err.name = 'InvalidPluginId';
    err.status = 400;
    throw err;
  }

  // Read manifest (check installed dir first, then local/dev)
  let manifest = await readPluginManifest(pluginsDir, pluginKey);
  let resolvedDir = pluginsDir;
  if (!manifest) {
    manifest = await readPluginManifest(localPluginsDir, pluginKey);
    resolvedDir = localPluginsDir;
  }

  if (!manifest) {
    const err = new Error('Plugin not found');
    err.name = 'PluginNotFound';
    err.status = 404;
    throw err;
  }

  // Create safe container name from plugin key (must match webpack config)
  const containerName = `plugin_${pluginKey.replace(/[^a-zA-Z0-9]/g, '_')}`;

  try {
    const assetsPath = path.join(resolvedDir, pluginKey, 'plugin.css');
    await fs.promises.access(assetsPath);
    manifest.cssFiles = [path.basename(assetsPath)];
  } catch {
    // plugin.css might not exist if plugin has no CSS or build failed
  }

  const result = {
    containerName,
    manifest,
    internalId: pluginKey,
  };

  // Cache the result
  if (cache) {
    await cache.set(cacheKey, result, CACHE_TTL);
  }

  return result;
}

/**
 * Get plugin static files directory path
 * @param {object} context - Context with cwd and models
 * @param {string} id - Plugin ID (DB UUID or encrypted key)
 * @returns {Promise<string|null>} Plugin static files directory path or null if invalid
 */
export async function getPluginStaticDir({ cwd, models }, id) {
  const pluginsDir = getPluginsDir(cwd, PLUGIN_PATH);
  const localPluginsDir = getPluginsDir(cwd, DEV_PLUGIN_PATH);

  // Try decrypting as encrypted key first
  let pluginKey = decryptPluginId(id);

  // If decryption failed, it might be a DB UUID
  if (!pluginKey && models) {
    const { Plugin } = models;
    const dbPlugin = await Plugin.findByPk(id);
    if (dbPlugin) {
      pluginKey = dbPlugin.key;
    }
  }

  if (!pluginKey) return null;

  // Check installed dir first, then local/dev
  const installedPath = path.join(pluginsDir, pluginKey);
  if (fs.existsSync(installedPath)) return installedPath;

  const localPath = path.join(localPluginsDir, pluginKey);
  if (fs.existsSync(localPath)) return localPath;

  return null;
}

/**
 * Install a plugin from an uploaded package (zip).
 *
 * Steps:
 *  1. Extract the zip to a temp directory.
 *  2. Read and validate the manifest (package.json).
 *  3. Move files to the final plugins directory.
 *  4. Create or update the DB record.
 *  5. Load the plugin via `pluginManager`.
 *  6. Log activity and invalidate cache.
 *
 * @param {Object}  file    - Uploaded file object ({ path, originalname })
 * @param {Object}  context - App context
 */
export async function installPluginFromPackage(
  file,
  { models, cache, cwd, fs: fsEngine, pluginManager, webhook, actorId },
) {
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

    // 2. Extract using shared FS engine
    await fsEngine.extract(tempPath, tempExtractDir);

    // 3. Read manifest (package.json)
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

    // 4. Validate manifest
    if (!manifest.name || !manifest.version) {
      throw new Error(
        'Invalid plugin manifest: missing required fields (name, version)',
      );
    }
    const pluginKey =
      (manifest.rsk && manifest.rsk.plugin && manifest.rsk.plugin.key) ||
      manifest.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // 5. Move to final destination
    const finalPluginDir = path.join(pluginsDir, pluginKey);

    if (fs.existsSync(finalPluginDir)) {
      await fs.promises.rm(finalPluginDir, { recursive: true, force: true });
    }

    await fs.promises.rename(pluginRoot, finalPluginDir);

    // 6. Create or update DB record
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

    // 7. Load the plugin via PluginManager
    if (pluginManager) {
      try {
        await pluginManager.reloadPlugin(plugin.id);

        const metadata = pluginManager.getPluginMetadata(plugin.id);
        if (
          metadata &&
          metadata.manifest &&
          Array.isArray(metadata.manifest.cssFiles) &&
          !pluginManager.isPluginLoaded(plugin.id)
        ) {
          await pluginManager.emit('plugin:loaded', { id: plugin.id });
        }
      } catch (err) {
        console.warn(
          `[pluginService] Failed to load plugin ${plugin.id} via PluginManager:`,
          err.message,
        );
      }
    }

    // 8. Log activity
    await logPluginActivity(
      webhook,
      created ? 'installed' : 'upgraded',
      plugin.id,
      { version: manifest.version },
      actorId,
    );

    return plugin;
  } catch (err) {
    console.error('Plugin install error:', err);
    throw err;
  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(tempExtractDir)) {
        await fs.promises.rm(tempExtractDir, { recursive: true, force: true });
      }

      if (file.fileName && fsEngine && typeof fsEngine.remove === 'function') {
        await fsEngine.remove(file.fileName);
      }

      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath);
      }
    } catch (_) {
      /* cleanup errors are non-fatal */
    }
  }
}

/**
 * Toggle plugin status
 */

export async function togglePluginStatus(
  id,
  isActive,
  { models, cache, cwd, pluginManager, webhook, actorId },
) {
  const { Plugin } = models;

  // Try finding by DB primary key first (for installed plugins)
  let plugin = await Plugin.findByPk(id);

  // If not found, the ID might be an encrypted plugin key (FS-only plugin)
  if (!plugin) {
    const pluginKey = decryptPluginId(id);
    if (pluginKey) {
      plugin = await Plugin.findOne({ where: { key: pluginKey } });

      // FS-only plugin with no DB record yet — create one
      if (!plugin && cwd) {
        let manifest = await readPluginManifest(
          getPluginsDir(cwd, PLUGIN_PATH),
          pluginKey,
        );

        // Also check local/dev plugins directory
        if (!manifest) {
          manifest = await readPluginManifest(
            getPluginsDir(cwd, DEV_PLUGIN_PATH),
            pluginKey,
          );
        }

        if (!manifest) {
          throw new Error('Plugin not found on disk');
        }

        [plugin] = await Plugin.findOrCreate({
          where: { key: pluginKey },
          defaults: {
            name: manifest.name || pluginKey,
            description: manifest.description || '',
            version: manifest.version || '0.0.0',
            is_active: isActive,
          },
        });
      }
    }
  }

  if (!plugin) {
    throw new Error('Plugin not found');
  }

  await plugin.update({ is_active: isActive });
  if (cache) await invalidateCache(cache, id);

  // Notify Plugin Manager to load/unload the plugin
  if (pluginManager) {
    try {
      if (isActive) {
        // Use reloadPlugin to ensure a clean load (handles stale state)
        await pluginManager.reloadPlugin(plugin.id);

        // If loadPlugin hit an early return (no server entry point),
        // plugin:loaded may not have fired — manually emit it so the
        // CSS entry-point handler in ServerPluginManager picks it up.
        const metadata = pluginManager.getPluginMetadata(plugin.id);
        if (
          metadata &&
          metadata.manifest &&
          Array.isArray(metadata.manifest.cssFiles) &&
          !pluginManager.isPluginLoaded(plugin.id)
        ) {
          await pluginManager.emit('plugin:loaded', { id: plugin.id });
        }
      } else if (pluginManager.isPluginLoaded(plugin.id)) {
        // Plugin is actively loaded — full unload lifecycle
        await pluginManager.unloadPlugin(plugin.id);
      } else {
        // Plugin was defined but not activated — emit event for cleanup
        await pluginManager.emit('plugin:unloaded', { id: plugin.id });
      }
    } catch (err) {
      console.warn(
        `[pluginService] Failed to ${isActive ? 'load' : 'unload'} plugin ${plugin.id} via PluginManager:`,
        err.message,
      );
    }
  }

  await logPluginActivity(
    webhook,
    'status_changed',
    plugin.id,
    { isActive },
    actorId,
  );

  return plugin;
}

/**
 * Upgrade plugin metadata
 * @param {string} id - Plugin UUID or encrypted key
 * @param {Object} data - Update data (name, description, version)
 * @param {Object} context - App context
 */
export async function upgradePlugin(
  id,
  data,
  { models, cache, webhook, actorId },
) {
  const { Plugin } = models;

  // Try finding by DB primary key first (for installed plugins)
  let plugin = await Plugin.findByPk(id);

  // If not found, the ID might be an encrypted plugin key
  if (!plugin) {
    const pluginKey = decryptPluginId(id);
    if (pluginKey) {
      plugin = await Plugin.findOne({ where: { key: pluginKey } });
    }
  }

  if (!plugin) {
    throw new Error('Plugin not found');
  }

  await plugin.update(data);
  if (cache) await invalidateCache(cache, id);

  await logPluginActivity(webhook, 'upgraded', plugin.id, data, actorId);

  return plugin;
}
