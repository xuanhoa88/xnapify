/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  CACHE_TTL,
  PluginError,
  resolvePlugin,
  resolvePluginDir,
  readPluginManifest,
  validateManifest,
  validatePluginNameSafe,
  invalidateCache,
  encryptPluginId,
} from './plugin.helpers';

// ========================================================================
// Internal Helpers
// ========================================================================

/**
 * Scan a directory and add plugins to the map
 * @param {string} dirPath - Directory path
 * @param {string} source - Source of plugins ('remote' or 'local')
 * @param {Map} fsPluginsMap - Map to store plugins
 */
async function scanDirectory(dirPath, source, fsPluginsMap) {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) {
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
            name: (manifest.rsk && manifest.rsk.name) || dirent.name,
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
}

// ========================================================================
// Service Functions
// ========================================================================

/**
 * Get all plugins (Admin) - Merged from DB and FS
 * @param {object} options - Options with models, cwd
 * @param {object} options.models - Models instance
 * @param {string} options.cwd - Current working directory
 * @returns {Promise<Array>} Array of plugin objects
 */
export async function managePlugins({ pluginManager, models, cwd, queue }) {
  const installedPluginsDir = pluginManager.getPluginPath();
  const localPluginsDir = pluginManager.getDevPluginPath(cwd);

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
        source: fsPlugin.source === 'local' ? 'db+local' : 'db+remote',
      });
    } else {
      // Plugin in DB but not on disk (Missing)
      // Deactivate from DB as per missing source logic instead of hard deletion to preserve configuration
      try {
        await dbPlugin.update({ is_active: false });
        console.info(
          `[managePlugins] Auto-deactivated missing plugin from DB: ${dbPlugin.key}`,
        );
      } catch (err) {
        console.error(
          `[managePlugins] Failed to auto-deactivate missing plugin: ${dbPlugin.key}`,
          err,
        );
      }
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
      const allJobs = await queueChannel.queue.getJobs();
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
export async function getActivePlugins({ pluginManager, models, cache, cwd }) {
  const ACTIVE_PLUGINS_CACHE_KEY = 'plugins:list:active';

  // Return cached result if valid
  if (cache) {
    const cached = await cache.get(ACTIVE_PLUGINS_CACHE_KEY);
    if (cached) return cached;
  }

  const { Plugin } = models;
  const installedPluginsDir = pluginManager.getPluginPath();
  const localPluginsDir = pluginManager.getDevPluginPath(cwd);

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
    if (
      localPluginsDir &&
      (manifest = await readPluginManifest(localPluginsDir, key))
    ) {
      isLocal = true;
    } else if (
      installedPluginsDir &&
      (manifest = await readPluginManifest(installedPluginsDir, key))
    ) {
      isLocal = false;
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
 *  3. Enqueue deletion via queue if available.
 *
 * @param {string} id - Plugin UUID or encrypted plugin key
 * @param {Object} context - App context
 */
export async function deletePlugin(id, { models, cache, cwd, actorId, queue }) {
  const { plugin } = await resolvePlugin(models, id);

  // Enqueue the background deletion job
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

  if (cache) await invalidateCache(cache, plugin.id);

  return true;
}

/**
 * Get plugin by ID (DB UUID or encrypted key)
 * @param {object} context - Context with cwd, models, and cache
 * @param {string} id - Plugin ID (DB UUID or encrypted key)
 * @returns {Promise<Object>} Plugin data with containerName and manifest
 * @throws {PluginError} If plugin ID is invalid or plugin not found
 */
export async function getPluginById({ pluginManager, cwd, models, cache }, id) {
  const cacheKey = `plugins:detail:${id}`;

  // Return cached result if available
  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  // Resolve plugin key from mixed ID
  const { plugin: dbPluginRecord, pluginKey } = await resolvePlugin(
    models,
    id,
    { required: false },
  );

  if (!pluginKey) {
    throw PluginError.invalidId();
  }

  // Resolve directory and manifest
  const { dir: resolvedDir, isDevPlugin } = resolvePluginDir(
    pluginManager,
    cwd,
    pluginKey,
  );

  let manifest = null;
  if (resolvedDir) {
    manifest = await readPluginManifest(path.dirname(resolvedDir), pluginKey);
  }

  if (!manifest) {
    throw PluginError.notFound(pluginKey);
  }

  // Read container name from manifest (written by the build step)
  const containerName = (manifest.rsk && manifest.rsk.containerName) || null;

  try {
    const assetsPath = path.join(resolvedDir, 'plugin.css');
    await fs.promises.access(assetsPath);
    manifest.hasClientCss = true;
  } catch {
    // plugin.css might not exist if plugin has no CSS or build failed
  }

  try {
    const assetsPath = path.join(resolvedDir, 'remote.js');
    await fs.promises.access(assetsPath);
    manifest.hasClientScript = true;
  } catch {
    // remote.js might not exist if plugin has no remote or build failed
  }

  // Validate checksum against DB (only for production plugins, not dev)
  if (models && !isDevPlugin) {
    const dbPlugin =
      dbPluginRecord ||
      (await models.Plugin.findOne({ where: { key: pluginKey } }));
    if (dbPlugin && dbPlugin.checksum) {
      const manifestChecksum = (manifest.rsk && manifest.rsk.checksum) || null;
      if (dbPlugin.checksum !== manifestChecksum) {
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
export async function getPluginStaticDir({ pluginManager, cwd, models }, id) {
  const { pluginKey } = await resolvePlugin(models, id, { required: false });
  if (!pluginKey) return null;

  const { dir } = resolvePluginDir(pluginManager, cwd, pluginKey);
  return dir;
}

/**
 * Install a plugin from an uploaded package (zip).
 *
 * Steps:
 *  1. Extract the zip to a temp directory.
 *  2. Read and validate the manifest (package.json).
 *  3. Move files to the final plugins directory.
 *  4. Create or update the DB record.
 *  5. Enqueue the heavy dependencies install and module reload.
 *  6. Log activities and invalidate cache.
 *
 * @param {Object}  file    - Uploaded file object ({ path, originalname })
 * @param {Object}  context - App context
 */
export async function installPluginFromPackage(
  file,
  { pluginManager, models, cache, fs: fsEngine, actorId, queue },
) {
  if (!file || !file.path) {
    throw PluginError.invalidPackage('No file provided');
  }

  if (!fsEngine || typeof fsEngine.extract !== 'function') {
    throw PluginError.invalidPackage('FS engine required for installation');
  }

  const { Plugin } = models;
  const tempPath = file.path;
  const pluginsDir = pluginManager.getPluginPath();
  const tempExtractDir = path.join(
    os.tmpdir(),
    process.env.RSK_PLUGIN_DIR || 'plugins',
    path.parse(file.originalname || '').name,
  );

  try {
    // 1. Prepare directories
    if (!pluginsDir) {
      throw PluginError.invalidPackage(
        'System plugins directory not configured',
      );
    }

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
      throw PluginError.invalidPackage(
        'Invalid plugin package: package.json not found. ' +
          'Ensure the zip contains package.json at the root, or in a single subdirectory.',
      );
    }

    const manifest = JSON.parse(
      await fs.promises.readFile(manifestPath, 'utf8'),
    );

    // 4. Validate manifest
    const { name: pluginName, version: pluginVersion } =
      validateManifest(manifest);

    // 4a. Security: prevent path traversal via crafted plugin names
    validatePluginNameSafe(pluginName, pluginsDir);

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
        name: (manifest.rsk && manifest.rsk.name) || pluginName,
        description: manifest.description,
        version: pluginVersion,
        is_active: true,
        options: {
          author: manifest.author,
          repository: manifest.repository,
        },
        checksum: (manifest.rsk && manifest.rsk.checksum) || null,
      },
    });

    if (!created) {
      await plugin.update({
        name: (manifest.rsk && manifest.rsk.name) || pluginName,
        description: manifest.description,
        version: pluginVersion,
        is_active: true,
        options: {
          author: manifest.author,
          repository: manifest.repository,
        },
        checksum: (manifest.rsk && manifest.rsk.checksum) || null,
      });
    }

    // 7. Enqueue the heavy dependencies install and module reload
    const queueChannel = queue('plugins');
    queueChannel.emit('install', {
      pluginDir: finalPluginDir,
      pluginId: plugin.id,
      pluginKey: pluginName,
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

      if (file.filename && fsEngine && typeof fsEngine.remove === 'function') {
        await fsEngine.remove(file.filename);
      }

      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath);
      }
    } catch (cleanupErr) {
      console.warn(
        '[installPluginFromPackage] Cleanup failed:',
        cleanupErr.message,
      );
    }
  }
}

/**
 * Toggle plugin status (activate / deactivate).
 *
 * @param {string} id - Plugin UUID or encrypted plugin key
 * @param {boolean} isActive - Desired status
 * @param {Object} context - App context
 */
export async function togglePluginStatus(
  id,
  isActive,
  { pluginManager, models, cache, cwd, actorId, queue },
) {
  const { Plugin } = models;

  // Resolve plugin — may need to create DB record for FS-only plugin
  let { plugin, pluginKey } = await resolvePlugin(models, id, {
    required: false,
  });

  // FS-only plugin with no DB record yet — create one
  if (!plugin && pluginKey && cwd) {
    const localPluginsDir = pluginManager.getDevPluginPath(cwd);
    const installedPluginsDir = pluginManager.getPluginPath();

    // Check local/dev first (dev override), then installed
    let manifest = null;
    if (localPluginsDir) {
      manifest = await readPluginManifest(localPluginsDir, pluginKey);
    }
    if (!manifest && installedPluginsDir) {
      manifest = await readPluginManifest(installedPluginsDir, pluginKey);
    }

    if (!manifest) {
      throw PluginError.notFound('on disk');
    }

    const { name: pluginName, version: pluginVersion } =
      validateManifest(manifest);

    [plugin] = await Plugin.findOrCreate({
      where: { key: pluginKey },
      defaults: {
        name: (manifest.rsk && manifest.rsk.name) || pluginName,
        description: manifest.description || '',
        version: pluginVersion,
        is_active: isActive,
        checksum: (manifest.rsk && manifest.rsk.checksum) || null,
      },
    });
  }

  if (!plugin) {
    throw PluginError.notFound();
  }

  // Resolve plugin physical directory on disk
  const { dir: pluginDir, isDevPlugin } = resolvePluginDir(
    pluginManager,
    cwd,
    plugin.key,
  );

  // Update plugin status
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
  { models, cache, hook, actorId },
) {
  const { plugin } = await resolvePlugin(models, id);

  await plugin.update(data);
  if (cache) await invalidateCache(cache, id);

  if (hook) {
    hook('admin:plugins').emit('upgraded', {
      plugin_id: plugin.id,
      options: data,
      actor_id: actorId,
    });
  }

  return plugin;
}
