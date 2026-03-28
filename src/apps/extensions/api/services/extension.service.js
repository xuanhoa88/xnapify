/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import snakeCase from 'lodash/snakeCase';

import {
  CACHE_TTL,
  ExtensionError,
  resolveExtension,
  validateManifest,
  invalidateCache,
} from './extension.helpers';

// ========================================================================
// Internal Helpers
// ========================================================================

async function pathExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan a directory and add extensions to the map
 * @param {string} dirPath - Directory path
 * @param {string} source - Source of extensions ('remote' or 'local')
 * @param {Map} metadata - Map to store extensions
 * @param {object} extensionManager - Extension manager
 */
async function scanDirectory(dirPath, source, metadata, extensionManager) {
  if (!dirPath) return;

  let files;
  try {
    files = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  const dirPromises = files.map(async dirent => {
    if (!dirent.isDirectory()) return;

    const manifest = await extensionManager.readManifest(dirPath, dirent.name);
    if (!manifest) return;

    // Use the filesystem directory name as map key — it matches the DB
    // Extension.key column (snakeCase'd manifest name).
    const mapKey = dirent.name;
    const rsk = manifest.rsk || {};

    metadata.set(mapKey, {
      id: manifest.id || mapKey,
      name: manifest.name || mapKey,
      version: manifest.version || '0.0.0',
      description: manifest.description || '',
      main: manifest.main || null,
      browser: manifest.browser || null,
      rsk,
      icon: rsk.icon || null,
      isInstalled: false, // Default, will be overwritten by DB check
      source, // 'remote' or 'local'
    });
  });

  await Promise.all(dirPromises);
}

// ========================================================================
// Service Functions
// ========================================================================

/**
 * Get all extensions (Admin) - Merged from DB and FS
 * @param {object} options - Options with models, cwd
 * @param {object} options.models - Models instance
 * @param {string} options.cwd - Current working directory
 * @returns {Promise<Array>} Array of extension objects
 */
export async function manageExtensions({
  extensionManager,
  models,
  cwd,
  queue,
}) {
  const installedExtensionsDir = extensionManager.getInstalledExtensionsDir();
  const localExtensionsDir = extensionManager.getDevExtensionsDir(cwd);

  const { Extension } = models;

  const extensions = [];
  const metadata = new Map();

  // 1. Scan File Systems (Remote & Local) in parallel
  const scanTasks = [
    scanDirectory(installedExtensionsDir, 'remote', metadata, extensionManager),
  ];
  if (localExtensionsDir && localExtensionsDir !== installedExtensionsDir) {
    scanTasks.push(
      scanDirectory(localExtensionsDir, 'local', metadata, extensionManager),
    );
  }
  await Promise.all(scanTasks);

  // 2. Fetch from DB
  const dbExtensions = await Extension.findAll();
  const dbExtensionsMap = new Map();
  dbExtensions.forEach(p => dbExtensionsMap.set(p.key, p));

  // 2a. Process DB extensions
  for (const dbExtension of dbExtensions) {
    const fsExtension = metadata.get(dbExtension.key);

    if (fsExtension) {
      // Extension exists in both DB and FS
      // Merge DB data into FS data. DB is the source of truth for status.
      metadata.set(dbExtension.key, {
        ...fsExtension,
        ...dbExtension.toJSON(),
        id: fsExtension.id,
        isActive: dbExtension.is_active,
        isInstalled: true,
        source: fsExtension.source === 'local' ? 'db+local' : 'db+remote',
      });
    } else {
      // Extension in DB but not on disk (Missing)
      // Deactivate from DB as per missing source logic instead of hard deletion to preserve configuration
      try {
        await dbExtension.update({ is_active: false });
        console.info(
          `[manageExtensions] Auto-deactivated missing extension from DB: ${dbExtension.key}`,
        );
      } catch (err) {
        console.error(
          `[manageExtensions] Failed to auto-deactivate missing extension: ${dbExtension.key}`,
          err,
        );
      }
    }
  }

  // 2b. Process new extensions on disk (Not in DB)
  for (const [key, manifest] of metadata.entries()) {
    if (!dbExtensionsMap.has(key)) {
      metadata.set(key, {
        ...manifest,
        isInstalled: false,
        isActive: false,
        source: manifest.source,
      });
    }
  }

  // Convert Map to Array
  extensions.push(...metadata.values());

  // Attach job_status if there are active queue jobs for these extensions
  if (queue) {
    const queueChannel = queue('extensions');
    if (
      queueChannel &&
      queueChannel.queue &&
      typeof queueChannel.queue.getJobs === 'function'
    ) {
      const allJobs = await queueChannel.queue.getJobs();
      const busyJobs = allJobs.filter(j =>
        ['pending', 'active', 'delayed'].includes(j.status),
      );

      // Map extensionKey → specific job_status
      const statusByExtensionKey = new Map();

      for (const job of busyJobs) {
        let status;
        if (job.name === 'toggle') {
          status = job.data.isActive ? 'ACTIVATING' : 'DEACTIVATING';
        } else if (job.name === 'delete') {
          status = 'UNINSTALLING';
        } else {
          status = 'INSTALLING';
        }

        if (job.data.extensionKey)
          statusByExtensionKey.set(job.data.extensionKey, status);
        if (job.data.extensionDir)
          statusByExtensionKey.set(
            path.basename(job.data.extensionDir),
            status,
          );
      }

      for (const p of extensions) {
        const status =
          statusByExtensionKey.get(p.id) ||
          statusByExtensionKey.get(p.key) ||
          statusByExtensionKey.get(p.name);
        if (status) {
          p.job_status = status;
        }
      }
    }
  }

  console.debug(
    `[manageExtensions] Total extensions found: ${extensions.length}`,
  );

  return extensions;
}

/**
 * Get active extensions (Public/Loader)
 * Optimised to only fetch active extensions from DB and verify FS presence.
 * Does NOT scan the entire extensions directory.
 * @param {object} options - Options with models, cache, cwd
 * @param {object} options.models - Models instance
 * @param {object} options.cache - Cache instance
 * @param {string} options.cwd - Current working directory
 * @returns {Promise<Array>} Array of active extension objects
 */
export async function getActiveExtensions({
  extensionManager,
  models,
  cache,
  cwd,
}) {
  const ACTIVE_EXTENSIONS_CACHE_KEY = 'extensions:list:active';

  // Return cached result if valid
  if (cache) {
    const cached = await cache.get(ACTIVE_EXTENSIONS_CACHE_KEY);
    if (cached) return cached;
  }

  const { Extension } = models;
  const installedExtensionsDir = extensionManager.getInstalledExtensionsDir();
  const localExtensionsDir = extensionManager.getDevExtensionsDir(cwd);

  // 1. Fetch only active extensions from DB
  const dbExtensions = await Extension.findAll({
    where: { is_active: true },
  });

  const extensions = [];

  // 2. Process each active extension
  for (const dbExtension of dbExtensions) {
    const { key } = dbExtension;
    let manifest = null;
    let isLocal = false;

    // Check Local first (dev override)
    if (
      localExtensionsDir &&
      (manifest = await extensionManager.readManifest(localExtensionsDir, key))
    ) {
      isLocal = true;
    } else if (
      installedExtensionsDir &&
      (manifest = await extensionManager.readManifest(
        installedExtensionsDir,
        key,
      ))
    ) {
      isLocal = false;
    }

    if (manifest) {
      // Detect built client assets so the client can resolve entry points
      // without a redundant per-extension API fetch.
      const baseDir = isLocal ? localExtensionsDir : installedExtensionsDir;
      const extDir = path.join(baseDir, key);
      if (await pathExists(path.join(extDir, 'remote.js'))) {
        manifest.hasClientScript = true;
      }
      if (await pathExists(path.join(extDir, 'extension.css'))) {
        manifest.hasClientCss = true;
      }

      // Extension is in DB (Active) AND on Disk
      // Note: manifest.name is the built directory name (e.g. rsk_extension_posts)
      // and dbExtension.name is the display name (e.g. @rsk-extension/posts).
      // We preserve manifest.name so resolveExtensionDir works correctly.
      extensions.push({
        ...manifest,
        ...dbExtension.toJSON(),
        id: manifest.id || dbExtension.key,
        name: manifest.name,
        isActive: true,
        isInstalled: true,
        source: isLocal ? 'local' : 'remote',
      });
    } else {
      // Logic decision: If active in DB but missing on disk, do we return it?
      // For frontend loader, a missing extension cannot be loaded.
      // So we skip it.
      console.warn(`Active extension ${key} missing from disk.`);
    }
  }

  // Update Cache
  if (cache) {
    await cache.set(ACTIVE_EXTENSIONS_CACHE_KEY, extensions, CACHE_TTL);
  }

  return extensions;
}

/**
 * Delete (uninstall) an extension — removes DB record and FS directory.
 *
 * Follows the same lookup pattern as `toggleExtensionStatus`:
 *  1. Try `findByPk(id)` for installed extensions.
 *  2. Try `findOne({ key: id })` for plain key (manifest.id).
 *  3. Enqueue deletion via queue if available.
 *
 * @param {string} id - Extension UUID or plain key (manifest.id)
 * @param {Object} context - App context
 */
export async function deleteExtension(
  id,
  { models, cache, cwd, actorId, queue },
) {
  const { extension, extensionKey } = await resolveExtension(models, id, {
    required: false,
  });

  // Extension not found in DB — could be a disk-only extension discovered from filesystem.
  // Decrypt the ID to get the extension key for directory deletion.
  if (!extension && !extensionKey) {
    throw ExtensionError.notFound();
  }

  // Enqueue the background deletion job
  if (queue && cwd) {
    const queueChannel = queue('extensions');
    queueChannel.emit('delete', {
      extensionKey: extension ? extension.key : extensionKey,
      actorId,
    });
  } else if (extension) {
    // Fallback if app context is missing: destroy DB record immediately
    await extension.destroy();
  }

  if (cache && extension) await invalidateCache(cache, extension.key);

  return true;
}

/**
 * Get extension by ID (DB UUID or encrypted key)
 * @param {object} context - Context with cwd, models, and cache
 * @param {string} id - Extension ID (DB UUID or encrypted key)
 * @returns {Promise<Object>} Extension data with manifest (includes id for MF container derivation)
 * @throws {ExtensionError} If extension ID is invalid or extension not found
 */
export async function getExtensionById(
  { extensionManager, models, cache },
  id,
) {
  const cacheKey = `extensions:detail:${id}`;

  // Return cached result if available
  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  // Resolve extension.key from mixed ID
  const { extension: dbExtensionRecord, extensionKey } = await resolveExtension(
    models,
    id,
    { required: false },
  );

  if (!extensionKey) {
    throw ExtensionError.invalidId();
  }

  // Resolve directory and manifest
  const { dir: resolvedDir, isDevExtension } =
    await extensionManager.resolveExtensionDir(extensionKey);

  let manifest = null;
  if (resolvedDir) {
    manifest = await extensionManager.readManifest(
      path.dirname(resolvedDir),
      extensionKey,
    );
  }

  if (!manifest) {
    throw ExtensionError.notFound(extensionKey);
  }

  // Ensure manifest.id is set — fallback to extensionKey for older manifests
  if (!manifest.id) {
    manifest.id = extensionKey;
  }

  if (await pathExists(path.join(resolvedDir, 'extension.css'))) {
    manifest.hasClientCss = true;
  }

  if (await pathExists(path.join(resolvedDir, 'remote.js'))) {
    manifest.hasClientScript = true;
  }

  // Validate checksum against DB (only for production extensions, not dev)
  if (models && !isDevExtension) {
    const dbExtension =
      dbExtensionRecord ||
      (await models.Extension.findOne({ where: { key: extensionKey } }));
    if (dbExtension && dbExtension.checksum) {
      const manifestChecksum = (manifest.rsk && manifest.rsk.checksum) || null;
      if (dbExtension.checksum !== manifestChecksum) {
        console.error(
          `[extensionService] ⛔ Checksum mismatch for extension "${extensionKey}": ` +
            `DB=${dbExtension.checksum}, manifest=${manifest.rsk.checksum}. ` +
            `Auto-deactivating extension — possible code tampering detected.`,
        );

        // Auto-deactivate the tampered extension
        await dbExtension.update({ is_active: false });

        // Invalidate cache so stale data isn't served
        if (cache) await invalidateCache(cache, extensionKey);

        // Flag it so the frontend can display a warning
        manifest.isTampered = true;
      }
    }
  }

  const result = {
    manifest,
  };

  // Cache the result
  if (cache) {
    await cache.set(cacheKey, result, CACHE_TTL);
  }

  return result;
}

/**
 * Get extension static files directory path
 * @param {object} context - Context with cwd and models
 * @param {string} id - Extension ID (DB UUID or encrypted key)
 * @returns {Promise<string|null>} Extension static files directory path or null if invalid
 */
export async function getExtensionStaticDir({ extensionManager, models }, id) {
  const { extensionKey } = await resolveExtension(models, id, {
    required: false,
  });
  if (!extensionKey) return null;

  const { dir } = await extensionManager.resolveExtensionDir(extensionKey);
  return dir;
}

/**
 * Install an extension from an uploaded package (zip).
 *
 * Steps:
 *  1. Extract the zip to a temp directory.
 *  2. Read and validate the manifest (package.json).
 *  3. Move files to the final extensions directory.
 *  4. Create or update the DB record.
 *  5. Enqueue the heavy dependencies install and module reload.
 *  6. Log activities and invalidate cache.
 *
 * @param {Object}  file    - Uploaded file object ({ path, originalname })
 * @param {Object}  context - App context
 */
export async function installExtensionFromPackage(
  file,
  { extensionManager, models, cache, fs: fsEngine, actorId, queue },
) {
  if (!file || !file.path) {
    throw ExtensionError.invalidPackage('No file provided');
  }

  if (!fsEngine || typeof fsEngine.extract !== 'function') {
    throw ExtensionError.invalidPackage('FS engine required for installation');
  }

  const { Extension } = models;
  const tempPath = file.path;
  const extensionsDir = extensionManager.getInstalledExtensionsDir();
  const tempExtractDir = path.join(
    os.tmpdir(),
    'rsk-extension-install',
    path.parse(file.originalname || '').name,
  );

  try {
    // 1. Prepare directories
    if (!extensionsDir) {
      throw ExtensionError.invalidPackage(
        'System extensions directory not configured',
      );
    }

    await fs.promises.mkdir(extensionsDir, { recursive: true });

    const tmpDir = path.dirname(tempExtractDir);
    await fs.promises.mkdir(tmpDir, { recursive: true });

    // 2. Extract using shared FS engine
    await fsEngine.extract(tempPath, tempExtractDir);

    // 3. Read manifest (package.json)
    let manifestPath = path.join(tempExtractDir, 'package.json');
    let extensionRoot = tempExtractDir;

    if (!(await pathExists(manifestPath))) {
      const entries = await fs.promises.readdir(tempExtractDir, {
        withFileTypes: true,
      });
      const subdirs = entries.filter(d => d.isDirectory());

      console.debug('[installExtensionFromPackage] Extracted contents:', {
        tempExtractDir,
        entries: entries.map(e => ({ name: e.name, isDir: e.isDirectory() })),
        subdirs: subdirs.map(d => d.name),
      });

      if (subdirs.length === 1) {
        extensionRoot = path.join(tempExtractDir, subdirs[0].name);
        manifestPath = path.join(extensionRoot, 'package.json');
      }
    }

    if (!(await pathExists(manifestPath))) {
      throw ExtensionError.invalidPackage(
        'Invalid extension package: package.json not found. ' +
          'Ensure the zip contains package.json at the root, or in a single subdirectory.',
      );
    }

    const manifest = JSON.parse(
      await fs.promises.readFile(manifestPath, 'utf8'),
    );

    // 4. Validate manifest
    const { name: extensionName, version: extensionVersion } =
      validateManifest(manifest);

    // Ensure manifest.id is set — fallback to snakeCase(name) for older manifests
    if (!manifest.id) {
      manifest.id = snakeCase(extensionName);
    }

    // 5. Move to final destination (use manifest.id for filesystem-safe dir name)
    const finalExtensionDir = path.join(extensionsDir, manifest.id);

    await fs.promises.rm(finalExtensionDir, { recursive: true, force: true });

    await fs.promises.rename(extensionRoot, finalExtensionDir);

    // 6. Create or update DB record (key = manifest.id = snakeCase dir name)
    const [extension, created] = await Extension.findOrCreate({
      where: { key: manifest.id },
      defaults: {
        name: extensionName,
        description: manifest.description,
        version: extensionVersion,
        is_active: true,
        options: {
          author: manifest.author,
          repository: manifest.repository,
        },
        checksum: (manifest.rsk && manifest.rsk.checksum) || null,
      },
    });

    if (!created) {
      await extension.update({
        name: extensionName,
        description: manifest.description,
        version: extensionVersion,
        is_active: true,
        options: {
          author: manifest.author,
          repository: manifest.repository,
        },
        checksum: (manifest.rsk && manifest.rsk.checksum) || null,
      });
    }

    // 7. Enqueue the heavy dependencies install and module reload
    const queueChannel = queue('extensions');
    queueChannel.emit('install', {
      extensionDir: finalExtensionDir,
      extensionKey: manifest.id,
      actorId,
    });

    if (cache) await invalidateCache(cache);

    return extension;
  } catch (err) {
    console.error('Extension install error:', err);
    throw err;
  } finally {
    // Cleanup temp files
    try {
      await fs.promises.rm(tempExtractDir, { recursive: true, force: true });

      if (file.filename && fsEngine && typeof fsEngine.remove === 'function') {
        await fsEngine.remove(file.filename);
      }

      await fs.promises.unlink(tempPath).catch(() => {});
    } catch (cleanupErr) {
      console.warn(
        '[installExtensionFromPackage] Cleanup failed:',
        cleanupErr.message,
      );
    }
  }
}

/**
 * Toggle extension status (activate / deactivate).
 *
 * @param {string} id - Extension UUID or encrypted extension.key
 * @param {boolean} isActive - Desired status
 * @param {Object} context - App context
 */
export async function toggleExtensionStatus(
  id,
  isActive,
  { extensionManager, models, cache, cwd, actorId, queue },
) {
  const { Extension } = models;

  // Resolve extension — may need to create DB record for FS-only extension
  let { extension, extensionKey } = await resolveExtension(models, id, {
    required: false,
  });

  // FS-only extension with no DB record yet — create one
  if (!extension && extensionKey && cwd) {
    const localExtensionsDir = extensionManager.getDevExtensionsDir(cwd);
    const installedExtensionsDir = extensionManager.getInstalledExtensionsDir();

    // Check local/dev first (dev override), then installed
    let manifest = null;
    if (localExtensionsDir) {
      manifest = await extensionManager.readManifest(
        localExtensionsDir,
        extensionKey,
      );
    }
    if (!manifest && installedExtensionsDir) {
      manifest = await extensionManager.readManifest(
        installedExtensionsDir,
        extensionKey,
      );
    }

    if (!manifest) {
      throw ExtensionError.notFound('on disk');
    }

    // Ensure manifest.id is set — fallback to extensionKey for older manifests
    if (!manifest.id) {
      manifest.id = extensionKey;
    }

    const { name: extensionName, version: extensionVersion } =
      validateManifest(manifest);

    [extension] = await Extension.findOrCreate({
      where: { key: extensionKey },
      defaults: {
        name: extensionName,
        description: manifest.description || '',
        version: extensionVersion,
        is_active: isActive,
        checksum: (manifest.rsk && manifest.rsk.checksum) || null,
      },
    });
  }

  if (!extension) {
    throw ExtensionError.notFound();
  }

  // Resolve extension physical directory on disk
  const { dir: extensionDir, isDevExtension } =
    await extensionManager.resolveExtensionDir(extension.key);

  // Update extension status
  await extension.update({ is_active: isActive });

  if (cache) await invalidateCache(cache, id);

  // Enqueue the background job for NPM dependencies and module reloading
  if (queue) {
    const queueChannel = queue('extensions');
    queueChannel.emit('toggle', {
      extensionKey: extension.key,
      extensionDir,
      isActive,
      actorId,
      isDevExtension,
    });
  }

  return extension;
}

/**
 * Upgrade extension metadata
 * @param {string} id - Extension UUID or encrypted key
 * @param {Object} data - Update data (name, description, version)
 * @param {Object} context - App context
 */
export async function upgradeExtension(
  id,
  data,
  { models, cache, hook, actorId },
) {
  const { extension } = await resolveExtension(models, id);

  await extension.update(data);
  if (cache) await invalidateCache(cache, id);

  if (hook) {
    hook('admin:extensions').emit('upgraded', {
      extension_id: extension.key,
      options: data,
      actor_id: actorId,
    });
  }

  return extension;
}
