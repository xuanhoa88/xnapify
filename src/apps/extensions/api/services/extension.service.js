/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import merge from 'lodash/merge';

import {
  CACHE_TTL,
  ExtensionError,
  resolveExtension,
  resolveExtensionDir,
  readExtensionManifest,
  validateManifest,
  validateExtensionNameSafe,
  invalidateCache,
  encryptExtensionId,
} from './extension.helpers';

// ========================================================================
// Internal Helpers
// ========================================================================

/**
 * Scan a directory and add extensions to the map
 * @param {string} dirPath - Directory path
 * @param {string} source - Source of extensions ('remote' or 'local')
 * @param {Map} fsExtensionsMap - Map to store extensions
 */
async function scanDirectory(dirPath, source, fsExtensionsMap) {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) {
      console.debug(`[manageExtensions] ${source} dir not found: ${dirPath}`);
      return;
    }
    const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
    console.debug(
      `[manageExtensions] Found ${files.length} items in ${source} dir: ${dirPath}`,
    );
    const dirPromises = files.map(async dirent => {
      if (dirent.isDirectory()) {
        console.debug(
          `[manageExtensions] Scanning extension: ${dirent.name} (${source})`,
        );
        const manifest = await readExtensionManifest(dirPath, dirent.name);
        if (manifest) {
          // Use manifest.name (the built package name) as map key so it
          // matches the DB key derived from snakeCase(manifest.name).
          // Falls back to folder name when manifest.name is absent.
          const mapKey = manifest.name || dirent.name;
          console.debug(`[manageExtensions] Added extension: ${mapKey}`);
          const encryptedId = encryptExtensionId(mapKey);
          const rsk = merge({}, manifest.rsk);

          // Derive type from manifest (plugin or module)
          const type =
            rsk.type === 'module' || rsk.type === 'plugin'
              ? rsk.type
              : 'plugin';

          // Derive capabilities from manifest fields
          const subscribe = rsk.subscribe || [];
          const capabilities = {
            api: Boolean(manifest.main),
            views: Boolean(manifest.browser),
            hooks: Array.isArray(subscribe) && subscribe.length > 0,
            translations: Boolean(rsk.translations),
          };

          fsExtensionsMap.set(mapKey, {
            ...manifest,
            name: rsk.name || mapKey,
            id: encryptedId,
            type,
            capabilities,
            isInstalled: false, // Default, will be overwritten by DB check
            source, // 'remote' or 'local'
          });
        }
      }
    });

    await Promise.all(dirPromises);
  } catch (err) {
    console.warn(`Failed to scan extensions dir: ${dirPath}`, err.message);
  }
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
  const installedExtensionsDir = extensionManager.getExtensionPath();
  const localExtensionsDir = extensionManager.getDevExtensionPath(cwd);

  const { Extension } = models;

  const extensions = [];
  const fsExtensionsMap = new Map();

  // 1. Scan File Systems (Remote & Local)
  // This populates fsExtensionsMap with what's physically available
  await scanDirectory(installedExtensionsDir, 'remote', fsExtensionsMap);

  // Only scan local dir if it differs from installed dir to avoid duplicate scanning
  if (localExtensionsDir !== installedExtensionsDir) {
    await scanDirectory(localExtensionsDir, 'local', fsExtensionsMap);
  }

  // 2. Fetch from DB
  const dbExtensions = await Extension.findAll();
  const dbExtensionsMap = new Map();
  dbExtensions.forEach(p => dbExtensionsMap.set(p.key, p));

  // 2a. Process DB extensions
  for (const dbExtension of dbExtensions) {
    const fsExtension = fsExtensionsMap.get(dbExtension.key);

    if (fsExtension) {
      // Extension exists in both DB and FS
      // Merge DB data into FS data. DB is the source of truth for status.
      fsExtensionsMap.set(dbExtension.key, {
        ...fsExtension,
        ...dbExtension.toJSON(),
        id: dbExtension.id,
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
  for (const [key, fsExtension] of fsExtensionsMap.entries()) {
    if (!dbExtensionsMap.has(key)) {
      fsExtensionsMap.set(key, {
        ...fsExtension,
        isInstalled: false,
        isActive: false,
        source: fsExtension.source,
      });
    }
  }

  // Convert Map to Array
  extensions.push(...fsExtensionsMap.values());

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

      // Map extensionId/extensionKey → specific job_status
      const statusByExtensionId = new Map();
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

        if (job.data.extensionId)
          statusByExtensionId.set(job.data.extensionId, status);
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
          statusByExtensionId.get(p.id) ||
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
  const installedExtensionsDir = extensionManager.getExtensionPath();
  const localExtensionsDir = extensionManager.getDevExtensionPath(cwd);

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
      (manifest = await readExtensionManifest(localExtensionsDir, key))
    ) {
      isLocal = true;
    } else if (
      installedExtensionsDir &&
      (manifest = await readExtensionManifest(installedExtensionsDir, key))
    ) {
      isLocal = false;
    }

    if (manifest) {
      // Extension is in DB (Active) AND on Disk
      extensions.push({
        ...manifest,
        ...dbExtension.toJSON(),
        id: dbExtension.id,
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
 *  2. Fall back to `decryptExtensionId` for FS-only extensions.
 *  3. Enqueue deletion via queue if available.
 *
 * @param {string} id - Extension UUID or encrypted extension.key
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
      extensionId: extension ? extension.id : null,
      extensionKey: extension ? extension.key : extensionKey,
      actorId,
    });
  } else if (extension) {
    // Fallback if app context is missing: destroy DB record immediately
    await extension.destroy();
  }

  if (cache && extension) await invalidateCache(cache, extension.id);

  return true;
}

/**
 * Get extension by ID (DB UUID or encrypted key)
 * @param {object} context - Context with cwd, models, and cache
 * @param {string} id - Extension ID (DB UUID or encrypted key)
 * @returns {Promise<Object>} Extension data with containerName and manifest
 * @throws {ExtensionError} If extension ID is invalid or extension not found
 */
export async function getExtensionById(
  { extensionManager, cwd, models, cache },
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
  const { dir: resolvedDir, isDevExtension } = resolveExtensionDir(
    extensionManager,
    cwd,
    extensionKey,
  );

  let manifest = null;
  if (resolvedDir) {
    manifest = await readExtensionManifest(
      path.dirname(resolvedDir),
      extensionKey,
    );
  }

  if (!manifest) {
    throw ExtensionError.notFound(extensionKey);
  }

  // Read container name from manifest (written by the build step)
  const containerName = (manifest.rsk && manifest.rsk.containerName) || null;

  try {
    const assetsPath = path.join(resolvedDir, 'extension.css');
    await fs.promises.access(assetsPath);
    manifest.hasClientCss = true;
  } catch {
    // extension.css might not exist if extension has no CSS or build failed
  }

  try {
    const assetsPath = path.join(resolvedDir, 'remote.js');
    await fs.promises.access(assetsPath);
    manifest.hasClientScript = true;
  } catch {
    // remote.js might not exist if extension has no remote or build failed
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
        if (cache) await invalidateCache(cache, dbExtension.id);

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
 * Get extension static files directory path
 * @param {object} context - Context with cwd and models
 * @param {string} id - Extension ID (DB UUID or encrypted key)
 * @returns {Promise<string|null>} Extension static files directory path or null if invalid
 */
export async function getExtensionStaticDir(
  { extensionManager, cwd, models },
  id,
) {
  const { extensionKey } = await resolveExtension(models, id, {
    required: false,
  });
  if (!extensionKey) return null;

  const { dir } = resolveExtensionDir(extensionManager, cwd, extensionKey);
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
  const extensionsDir = extensionManager.getExtensionPath();
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

    if (!fs.existsSync(extensionsDir)) {
      await fs.promises.mkdir(extensionsDir, { recursive: true });
    }

    const tmpDir = path.dirname(tempExtractDir);
    if (!fs.existsSync(tmpDir)) {
      await fs.promises.mkdir(tmpDir, { recursive: true });
    }

    // 2. Extract using shared FS engine
    await fsEngine.extract(tempPath, tempExtractDir);

    // 3. Read manifest (package.json)
    let manifestPath = path.join(tempExtractDir, 'package.json');
    let extensionRoot = tempExtractDir;

    if (!fs.existsSync(manifestPath)) {
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

    if (!fs.existsSync(manifestPath)) {
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

    // 4a. Security: prevent path traversal via crafted extension names
    validateExtensionNameSafe(extensionName, extensionsDir);

    // 5. Move to final destination
    const finalExtensionDir = path.join(extensionsDir, extensionName);

    if (fs.existsSync(finalExtensionDir)) {
      await fs.promises.rm(finalExtensionDir, { recursive: true, force: true });
    }

    await fs.promises.rename(extensionRoot, finalExtensionDir);

    // 6. Create or update DB record
    const [extension, created] = await Extension.findOrCreate({
      where: { key: extensionName },
      defaults: {
        name: (manifest.rsk && manifest.rsk.name) || extensionName,
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
        name: (manifest.rsk && manifest.rsk.name) || extensionName,
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
      extensionId: extension.id,
      extensionKey: extensionName,
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
    const localExtensionsDir = extensionManager.getDevExtensionPath(cwd);
    const installedExtensionsDir = extensionManager.getExtensionPath();

    // Check local/dev first (dev override), then installed
    let manifest = null;
    if (localExtensionsDir) {
      manifest = await readExtensionManifest(localExtensionsDir, extensionKey);
    }
    if (!manifest && installedExtensionsDir) {
      manifest = await readExtensionManifest(
        installedExtensionsDir,
        extensionKey,
      );
    }

    if (!manifest) {
      throw ExtensionError.notFound('on disk');
    }

    const { name: extensionName, version: extensionVersion } =
      validateManifest(manifest);

    [extension] = await Extension.findOrCreate({
      where: { key: extensionKey },
      defaults: {
        name: (manifest.rsk && manifest.rsk.name) || extensionName,
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
  const { dir: extensionDir, isDevExtension } = resolveExtensionDir(
    extensionManager,
    cwd,
    extension.key,
  );

  // Update extension status
  await extension.update({ is_active: isActive });

  if (cache) await invalidateCache(cache, id);

  // Enqueue the background job for NPM dependencies and module reloading
  if (queue) {
    const queueChannel = queue('extensions');
    queueChannel.emit('toggle', {
      extensionId: extension.id,
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
      extension_id: extension.id,
      options: data,
      actor_id: actorId,
    });
  }

  return extension;
}
