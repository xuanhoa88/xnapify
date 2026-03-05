/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { encryptPluginId, decryptPluginId } from '../utils/crypto';
import { logPluginActivity } from '../utils/activity';
import { computeChecksum, verifyPluginChecksum } from '../utils/checksum';

// Promisify execFile
const execFileAsync = promisify(execFile);

// Cache for plugin list
const CACHE_TTL = 60 * 1000; // 1 minute

// Plugin path getters
const getPluginPath = () =>
  process.env.RSK_PLUGIN_PATH || path.join(os.homedir(), '.rsk', 'plugins');

const getDevPluginPath = () => process.env.RSK_LOCAL_PLUGIN_PATH || 'plugins';

// Resolve plugins directory
const resolvePluginsDir = (cwd, pluginPath) =>
  path.resolve(cwd || process.cwd(), pluginPath);

/**
 * Install plugin dependencies
 * @param {string} pluginDir - Plugin directory path
 * @param {object} plugin - Plugin object
 */
async function installPluginDependencies(pluginDir, plugin) {
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
    const err = new Error(
      `Failed to install dependencies for plugin ${plugin.name}`,
    );
    err.status = 500;
    throw err;
  }
}

/**
 * Uninstall plugin dependencies
 * @param {string} pluginDir - Plugin directory path
 * @param {object} plugin - Plugin object
 */
async function uninstallPluginDependencies(pluginDir, plugin) {
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
    const err = new Error(
      `Failed to uninstall dependencies for plugin ${plugin.name}`,
    );
    err.status = 500;
    throw err;
  }
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
    const dirPromises = files.map(async dirent => {
      if (dirent.isDirectory()) {
        console.debug(
          `[managePlugins] Scanning plugin: ${dirent.name} (${source})`,
        );
        const manifest = await readPluginManifest(dirPath, dirent.name);
        if (manifest) {
          console.debug(`[managePlugins] Added plugin: ${dirent.name}`);
          const encryptedId = encryptPluginId(dirent.name);
          fsPluginsMap.set(dirent.name, {
            ...manifest,
            id: encryptedId,
            isInstalled: false, // Default, will be overwritten by DB check
            source, // 'remote' or 'local'
          });
        }
      }
    });

    await Promise.all(dirPromises);
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
export async function managePlugins({ models, cwd, queue }) {
  const installedPluginsDir = resolvePluginsDir(cwd, getPluginPath());
  const localPluginsDir = resolvePluginsDir(cwd, getDevPluginPath());

  const { Plugin } = models;

  const plugins = [];
  const fsPluginsMap = new Map();

  // 1. Scan File Systems (Remote & Local)
  // This populates fsPluginsMap with what's physically available
  await scanDirectory(installedPluginsDir, 'remote', fsPluginsMap);

  // Only scan local dir if it differs from installed dir to avoid duplicate scanning
  if (localPluginsDir !== installedPluginsDir) {
    await scanDirectory(localPluginsDir, 'local', fsPluginsMap);
  }

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
        isActive: dbPlugin.is_active,
        isInstalled: true,
        source: 'db+remote',
      });
    } else {
      // Plugin in DB but not on disk (Missing)
      plugins.push({
        ...dbPlugin.toJSON(),
        id: dbPlugin.id,
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
      });
    }
  }

  // Convert Map to Array
  plugins.push(...fsPluginsMap.values());

  // Attach job_status if there are active queue jobs for these plugins
  if (queue) {
    const queueChannel = queue('plugins');
    if (
      queueChannel &&
      queueChannel.queue &&
      typeof queueChannel.queue.getJobs === 'function'
    ) {
      const allJobs = queueChannel.queue.getJobs();
      const busyJobs = allJobs.filter(j =>
        ['pending', 'active', 'delayed'].includes(j.status),
      );
      const busyPluginIds = new Set();
      const busyPluginKeys = new Set();

      for (const job of busyJobs) {
        if (job.data.pluginId) busyPluginIds.add(job.data.pluginId);
        if (job.data.pluginKey) busyPluginKeys.add(job.data.pluginKey);
        // Special case for install which might only have pluginDir/pluginName before DB is known
        if (job.data.pluginDir)
          busyPluginKeys.add(path.basename(job.data.pluginDir));
      }

      for (const p of plugins) {
        if (
          busyPluginIds.has(p.id) ||
          busyPluginKeys.has(p.key) ||
          busyPluginKeys.has(p.name)
        ) {
          p.job_status = 'ACTIVE';
        }
      }
    }
  }

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
  const installedPluginsDir = resolvePluginsDir(cwd, getPluginPath());
  const localPluginsDir = resolvePluginsDir(cwd, getDevPluginPath());

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
        isActive: true,
        isInstalled: true,
        source: isLocal ? 'local' : 'remote',
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
export async function deletePlugin(id, { models, cache, cwd, actorId, queue }) {
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
    const err = new Error('Plugin not found');
    err.name = 'PluginNotFound';
    err.status = 404;
    throw err;
  }

  // 1.5. Check if we have context to enqueue the deletion
  if (queue && cwd) {
    const queueChannel = queue('plugins');
    queueChannel.emit('delete', {
      pluginId: plugin.id,
      pluginKey: plugin.key,
      actorId,
    });
  } else {
    // Fallback if app context is missing: destroy DB record immediately
    await plugin.destroy();
  }

  if (cache) await invalidateCache(cache);

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

  const pluginsDir = resolvePluginsDir(cwd, getPluginPath());
  const localPluginsDir = resolvePluginsDir(cwd, getDevPluginPath());

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

  // Read container name from manifest (written by the build step)
  const containerName = (manifest.rsk && manifest.rsk.containerName) || null;

  try {
    const assetsPath = path.join(resolvedDir, pluginKey, 'plugin.css');
    await fs.promises.access(assetsPath);
    manifest.hasClientCss = true;
  } catch {
    // plugin.css might not exist if plugin has no CSS or build failed
  }

  try {
    const assetsPath = path.join(resolvedDir, pluginKey, 'remote.js');
    await fs.promises.access(assetsPath);
    manifest.hasClientScript = true;
  } catch {
    // remote.js might not exist if plugin has no remote or build failed
  }

  // Validate checksum against DB (only for production plugins, not dev)
  const isDevPlugin = resolvedDir === localPluginsDir;
  if (models && !isDevPlugin) {
    const { Plugin } = models;
    const dbPlugin = await Plugin.findOne({ where: { key: pluginKey } });
    if (
      dbPlugin &&
      dbPlugin.checksum &&
      manifest.rsk &&
      manifest.rsk.checksum &&
      dbPlugin.checksum !== manifest.rsk.checksum
    ) {
      console.error(
        `[pluginService] ⛔ Checksum mismatch for plugin "${pluginKey}": ` +
          `DB=${dbPlugin.checksum}, manifest=${manifest.rsk.checksum}. ` +
          `Auto-deactivating plugin — possible code tampering detected.`,
      );

      // Auto-deactivate the tampered plugin
      await dbPlugin.update({ is_active: false });

      // Invalidate cache so stale data isn't served
      if (cache) await invalidateCache(cache, dbPlugin.id);

      // Flag it so the frontend can display a warning
      manifest.isTampered = true;
    }
  }

  const result = {
    containerName,
    manifest,
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
  const pluginsDir = resolvePluginsDir(cwd, getPluginPath());
  const localPluginsDir = resolvePluginsDir(cwd, getDevPluginPath());

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
  { models, cache, cwd, fs: fsEngine, actorId, queue },
) {
  if (!file || !file.path) {
    const err = new Error('No file provided');
    err.name = 'InvalidPluginPackage';
    err.status = 400;
    throw err;
  }

  if (!fsEngine || typeof fsEngine.extract !== 'function') {
    const err = new Error('FS engine required for installation');
    err.name = 'InvalidPluginPackage';
    err.status = 400;
    throw err;
  }

  const { Plugin } = models;
  const tempPath = file.path;
  const pluginsDir = resolvePluginsDir(cwd, getPluginPath());
  const tempExtractDir = path.join(
    os.tmpdir(),
    getPluginPath(),
    path.parse(file.originalName).name,
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

      console.debug('[installPluginFromPackage] Extracted contents:', {
        tempExtractDir,
        entries: entries.map(e => ({ name: e.name, isDir: e.isDirectory() })),
        subdirs: subdirs.map(d => d.name),
      });

      if (subdirs.length === 1) {
        pluginRoot = path.join(tempExtractDir, subdirs[0].name);
        manifestPath = path.join(pluginRoot, 'package.json');
      }
    }

    if (!fs.existsSync(manifestPath)) {
      const err = new Error(
        'Invalid plugin package: package.json not found. ' +
          'Ensure the zip contains package.json at the root, or in a single subdirectory.',
      );
      err.name = 'InvalidPluginPackage';
      err.status = 400;
      throw err;
    }

    const manifest = JSON.parse(
      await fs.promises.readFile(manifestPath, 'utf8'),
    );

    // 4. Validate manifest
    const pluginName =
      typeof manifest.name === 'string' ? manifest.name.trim() : '';
    const pluginVersion =
      typeof manifest.version === 'string' ? manifest.version.trim() : '';
    if (pluginName.length === 0 || pluginVersion.length === 0) {
      const err = new Error(
        'Invalid plugin manifest: missing required fields (name, version)',
      );
      err.name = 'InvalidPluginPackage';
      err.status = 400;
      throw err;
    }

    // 5. Move to final destination
    const finalPluginDir = path.join(pluginsDir, pluginName);

    if (fs.existsSync(finalPluginDir)) {
      await fs.promises.rm(finalPluginDir, { recursive: true, force: true });
    }

    await fs.promises.rename(pluginRoot, finalPluginDir);

    // 6. Create or update DB record
    const [plugin, created] = await Plugin.findOrCreate({
      where: { key: pluginName },
      defaults: {
        name: pluginName,
        description: manifest.description,
        version: pluginVersion,
        is_active: true,
        checksum: (manifest.rsk && manifest.rsk.checksum) || null,
      },
    });

    if (!created) {
      await plugin.update({
        name: pluginName,
        description: manifest.description,
        version: pluginVersion,
        is_active: true,
        checksum: (manifest.rsk && manifest.rsk.checksum) || null,
      });
    }

    // 7. Enqueue the heavy dependencies install and module reload
    const queueChannel = queue('plugins');
    queueChannel.emit('install', {
      pluginDir: finalPluginDir,
      pluginId: plugin.id,
      actorId,
    });

    if (cache) await invalidateCache(cache);

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
  { models, cache, cwd, actorId, queue },
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
          resolvePluginsDir(cwd, getPluginPath()),
          pluginKey,
        );

        // Also check local/dev plugins directory
        if (!manifest) {
          manifest = await readPluginManifest(
            resolvePluginsDir(cwd, getDevPluginPath()),
            pluginKey,
          );
        }

        if (!manifest) {
          const err = new Error('Plugin not found on disk');
          err.name = 'PluginNotFound';
          err.status = 404;
          throw err;
        }

        const pluginName =
          typeof manifest.name === 'string' ? manifest.name.trim() : '';
        const pluginVersion =
          typeof manifest.version === 'string' ? manifest.version.trim() : '';
        if (pluginName.length === 0 || pluginVersion.length === 0) {
          const err = new Error(
            'Invalid plugin manifest: missing required fields (name, version)',
          );
          err.name = 'InvalidPluginPackage';
          err.status = 400;
          throw err;
        }

        [plugin] = await Plugin.findOrCreate({
          where: { key: pluginKey },
          defaults: {
            name: pluginName,
            description: manifest.description || '',
            version: pluginVersion,
            is_active: isActive,
            checksum: (manifest.rsk && manifest.rsk.checksum) || null,
          },
        });
      }
    }
  }

  if (!plugin) {
    const err = new Error('Plugin not found');
    err.name = 'PluginNotFound';
    err.status = 404;
    throw err;
  }

  // Resolve plugin physical directory on disk
  let pluginDir = null;
  let isDevPlugin = false;
  if (cwd && plugin.key) {
    const prodPath = path.join(
      resolvePluginsDir(cwd, getPluginPath()),
      plugin.key,
    );
    const devPath = path.join(
      resolvePluginsDir(cwd, getDevPluginPath()),
      plugin.key,
    );

    if (fs.existsSync(prodPath)) {
      pluginDir = prodPath;
    } else if (fs.existsSync(devPath)) {
      pluginDir = devPath;
      isDevPlugin = true;
    }
  }

  await plugin.update({ is_active: isActive });
  if (cache) await invalidateCache(cache, id);

  // Enqueue the background job for NPM dependencies and module reloading
  if (queue) {
    const queueChannel = queue('plugins');
    queueChannel.emit('toggle', {
      pluginId: plugin.id,
      pluginKey: plugin.key,
      pluginDir,
      isActive,
      actorId,
      isDevPlugin,
    });
  }

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
    const err = new Error('Plugin not found');
    err.name = 'PluginNotFound';
    err.status = 404;
    throw err;
  }

  await plugin.update(data);
  if (cache) await invalidateCache(cache, id);

  await logPluginActivity(webhook, 'upgraded', plugin.id, data, actorId);

  return plugin;
}

/**
 * Register background workers for plugin tasks.
 * Called during server initialization.
 */
export function registerPluginWorkers(app) {
  const queue = app.get('queue')('plugins');

  // WORKER: Install Plugin
  queue.on('install', async job => {
    const { pluginDir, pluginId, actorId } = job.data;
    const pluginManager = app.get('plugin');
    const webhook = app.get('webhook');
    try {
      job.updateProgress(10);
      await installPluginDependencies(pluginDir);
      job.updateProgress(50);

      // Compute and store checksum after clean install
      const checksum = await computeChecksum(pluginDir);
      const { Plugin } = app.get('models');
      await Plugin.update({ checksum }, { where: { id: pluginId } });
      job.updateProgress(60);

      if (pluginManager) {
        await pluginManager.reloadPlugin(pluginId);
        const metadata = pluginManager.getPluginMetadata(pluginId);
        if (
          metadata &&
          metadata.manifest &&
          !pluginManager.isPluginLoaded(pluginId)
        ) {
          await pluginManager.emit('plugin:loaded', { id: pluginId });
        }
      }
      job.updateProgress(90);

      await logPluginActivity(
        webhook,
        'installed',
        pluginId,
        { path: pluginDir, checksum },
        actorId,
      );

      const ws = app.get('ws');
      if (ws) {
        // Include manifest data so ClientPluginManager can inject CSS/JS tags
        const metadata = pluginManager
          ? pluginManager.getPluginMetadata(pluginId)
          : null;
        ws.sendToPublicChannel('plugin:updated', {
          type: 'PLUGIN_INSTALLED',
          pluginId,
          data: {
            manifest:
              metadata && metadata.manifest
                ? {
                    hasClientCss: metadata.manifest.hasClientCss || false,
                    hasClientScript: metadata.manifest.hasClientScript || false,
                    version: metadata.manifest.version || '0.0.0',
                  }
                : null,
          },
        });
      }
      job.updateProgress(100);
      return { success: true };
    } catch (err) {
      console.error(`[PluginWorker] Install failed for ${pluginId}:`, err);
      throw err;
    }
  });

  // WORKER: Delete Plugin
  queue.on('delete', async job => {
    const { pluginId, pluginKey, actorId } = job.data;
    const cwd = app.get('cwd');
    const pluginManager = app.get('plugin');
    const webhook = app.get('webhook');
    const { Plugin } = app.get('models');

    try {
      if (pluginManager) {
        if (pluginManager.isPluginLoaded(pluginId)) {
          await pluginManager.unloadPlugin(pluginId);
        } else {
          await pluginManager.emit('plugin:unloaded', { id: pluginId });
        }
      }

      // Remove files
      if (cwd) {
        const dirs = [
          resolvePluginsDir(cwd, getPluginPath()),
          resolvePluginsDir(cwd, getDevPluginPath()),
        ];
        for (const baseDir of dirs) {
          const pDir = path.join(baseDir, pluginKey);
          const relative = path.relative(baseDir, pDir);
          if (
            relative &&
            !relative.startsWith('..') &&
            !path.isAbsolute(relative)
          ) {
            if (fs.existsSync(pDir)) {
              await uninstallPluginDependencies(pDir);
              await fs.promises.rm(pDir, { recursive: true, force: true });
            }
          }
        }
      }

      await Plugin.destroy({ where: { id: pluginId } });
      await logPluginActivity(
        webhook,
        'deleted',
        pluginId,
        { key: pluginKey },
        actorId,
      );

      const ws = app.get('ws');
      if (ws) {
        ws.sendToPublicChannel('plugin:updated', {
          type: 'PLUGIN_UNINSTALLED',
          pluginId,
        });
      }

      return { success: true };
    } catch (err) {
      console.error(`[PluginWorker] Delete failed for ${pluginId}:`, err);
      throw err;
    }
  });

  // WORKER: Toggle Plugin
  queue.on('toggle', async job => {
    const { pluginId, isActive, actorId, pluginDir, isDevPlugin } = job.data;
    const pluginManager = app.get('plugin');
    const webhook = app.get('webhook');

    try {
      // Security: verify checksum before activating (skip for dev plugins)
      if (isActive && pluginDir && !isDevPlugin) {
        const { Plugin } = app.get('models');
        const dbPlugin = await Plugin.findByPk(pluginId);
        if (dbPlugin && dbPlugin.checksum) {
          const { valid, actual } = await verifyPluginChecksum(
            pluginDir,
            dbPlugin.checksum,
          );
          if (!valid) {
            console.error(
              `[PluginWorker] ⛔ Checksum verification FAILED for plugin ${pluginId}. ` +
                `Expected: ${dbPlugin.checksum}, Got: ${actual}. ` +
                `Refusing to activate — possible code injection detected.`,
            );
            await dbPlugin.update({ is_active: false });

            const ws = app.get('ws');
            if (ws) {
              ws.sendToPublicChannel('plugin:updated', {
                type: 'PLUGIN_TAMPERED',
                pluginId,
              });
            }
            return { success: false, reason: 'checksum_mismatch' };
          }
        }
      }

      if (pluginDir) {
        if (isActive) {
          await installPluginDependencies(pluginDir);

          // Recompute and store checksum after fresh npm install
          const checksum = await computeChecksum(pluginDir);
          const { Plugin } = app.get('models');
          await Plugin.update({ checksum }, { where: { id: pluginId } });
        } else {
          await uninstallPluginDependencies(pluginDir);
        }
      }

      if (pluginManager) {
        if (isActive) {
          await pluginManager.reloadPlugin(pluginId);
          const metadata = pluginManager.getPluginMetadata(pluginId);
          if (
            metadata &&
            metadata.manifest &&
            !pluginManager.isPluginLoaded(pluginId)
          ) {
            await pluginManager.emit('plugin:loaded', { id: pluginId });
          }
        } else {
          if (pluginManager.isPluginLoaded(pluginId)) {
            await pluginManager.unloadPlugin(pluginId);
          } else {
            await pluginManager.emit('plugin:unloaded', { id: pluginId });
          }
        }
      }

      await logPluginActivity(
        webhook,
        'status_changed',
        pluginId,
        { isActive },
        actorId,
      );

      const ws = app.get('ws');
      if (ws) {
        if (isActive) {
          // Include manifest data so ClientPluginManager can inject CSS/JS tags
          const metadata = pluginManager
            ? pluginManager.getPluginMetadata(pluginId)
            : null;
          ws.sendToPublicChannel('plugin:updated', {
            type: 'PLUGIN_UPDATED',
            pluginId,
            data: {
              manifest:
                metadata && metadata.manifest
                  ? {
                      hasClientCss: metadata.manifest.hasClientCss || false,
                      hasClientScript:
                        metadata.manifest.hasClientScript || false,
                      version: metadata.manifest.version || '0.0.0',
                    }
                  : null,
            },
          });
        } else {
          ws.sendToPublicChannel('plugin:updated', {
            type: 'PLUGIN_UNINSTALLED',
            pluginId,
          });
        }
      }
      return { success: true };
    } catch (err) {
      console.error(`[PluginWorker] Toggle failed for ${pluginId}:`, err);
      throw err;
    }
  });
}
