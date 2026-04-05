/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  CACHE_TTL,
  ExtensionError,
  resolveExtension,
  validateManifest,
  invalidateCache,
} from './extension.helpers';

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

  const processDirent = async (dirent, parentScope = '') => {
    if (!dirent.isDirectory()) return;

    if (!parentScope && dirent.name.startsWith('@')) {
      const scopePath = path.join(dirPath, dirent.name);
      let scopeFiles;
      try {
        scopeFiles = await fs.promises.readdir(scopePath, {
          withFileTypes: true,
        });
      } catch {
        return;
      }
      await Promise.all(
        scopeFiles.map(scopeDirent => processDirent(scopeDirent, dirent.name)),
      );
      return;
    }

    const manifestArgs = parentScope
      ? [dirPath, parentScope, dirent.name]
      : [dirPath, dirent.name];
    const manifest = await extensionManager.readManifest(...manifestArgs);
    if (!manifest) return;

    metadata.set(manifest.id, {
      ...manifest,
      isInstalled: false,
      source,
    });
  };

  const dirPromises = files.map(dirent => processDirent(dirent));
  await Promise.all(dirPromises);
}

/**
 * Find a disk-only extension by its ID.
 * Since disk directories are named by `manifest.name`, we must scan all manifests to find by `id`.
 * @param {object} extensionManager - Extension manager
 * @param {string} cwd - Current working directory
 * @param {string} id - Extension ID
 * @returns {Promise<Object|null>} Manifest object if found
 */
async function getDiskExtensionById(extensionManager, cwd, id) {
  if (!id) return null;
  const installedExtensionsDir = extensionManager.getInstalledExtensionsDir();
  const localExtensionsDir = extensionManager.getDevExtensionsDir(cwd);

  const metadata = new Map();
  const scanTasks = [
    scanDirectory(installedExtensionsDir, 'remote', metadata, extensionManager),
  ];
  if (localExtensionsDir && localExtensionsDir !== installedExtensionsDir) {
    scanTasks.push(
      scanDirectory(localExtensionsDir, 'local', metadata, extensionManager),
    );
  }
  await Promise.all(scanTasks);

  return metadata.get(id) || null;
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
  _cwd,
}) {
  const ACTIVE_EXTENSIONS_CACHE_KEY = 'extensions:list:active';

  // Return cached result if valid
  if (cache) {
    const cached = await cache.get(ACTIVE_EXTENSIONS_CACHE_KEY);
    if (cached) return cached;
  }

  const { Extension } = models;

  // 1. Fetch only active extensions from DB
  const dbExtensions = await Extension.findAll({
    where: { is_active: true },
  });

  const extensions = [];

  // 2. Process each active extension
  for (const dbExtension of dbExtensions) {
    const { name, key } = dbExtension;

    // Resolve the actual FS directory — directories are named by manifest.name
    const { dir: extDir, isDevExtension } =
      await extensionManager.resolveExtensionDir(name);
    if (!extDir) {
      console.warn(`Active extension ${name} (${key}) missing from disk.`);
      continue;
    }

    const manifest = await extensionManager.readManifest(extDir);
    if (!manifest) {
      console.warn(`Active extension ${key} missing manifest at ${extDir}.`);
      continue;
    }

    extensions.push({
      ...manifest,
      ...dbExtension.toJSON(),
      id: manifest.id || dbExtension.key,
      name: manifest.name,
      isActive: true,
      isInstalled: true,
      source: isDevExtension ? 'local' : 'remote',
    });
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
 * Resolves the extension by its canonical key (manifest.id = DB `key`),
 * then enqueues the deletion job via the background queue.
 *
 * @param {string} id - Extension key (manifest.id)
 * @param {Object} context - App context
 */
export async function deleteExtension(
  id,
  { extensionManager, models, cache, cwd, actorId, queue },
) {
  const { extension } = await resolveExtension(models, id, {
    required: false,
  });

  // Canonical key: DB record's key, or raw ID for disk-only extensions
  const key = extension ? extension.key : id;

  let extensionName = extension ? extension.name : key;
  if (!extension) {
    const diskExt = await getDiskExtensionById(extensionManager, cwd, id);
    if (diskExt) {
      extensionName = diskExt.name;
    }
  }

  // Guard: must deactivate before uninstall/delete
  if (extension && extension.is_active) {
    const error = new Error(
      'Cannot delete an active extension. Deactivate it first.',
    );
    error.statusCode = 400;
    throw error;
  }

  // Enqueue the background deletion job
  if (queue && cwd) {
    const queueChannel = queue('extensions');
    queueChannel.emit('delete', {
      extensionKey: key,
      extensionName,
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
 * Get extension details by key.
 * @param {object} context - Context with cwd, models, and cache
 * @param {string} id - Extension key (manifest.id)
 * @returns {Promise<Object>} Extension data with manifest
 * @throws {ExtensionError} If extension ID is invalid or extension not found
 */
export async function getExtensionById(
  { extensionManager, models, cache, cwd },
  id,
) {
  const cacheKey = `extensions:detail:${id}`;

  // Return cached result if available
  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  // Resolve extension record by canonical key
  const { extension: dbRecord } = await resolveExtension(models, id, {
    required: false,
  });

  let extensionName = dbRecord ? dbRecord.name : null;
  if (!extensionName) {
    const diskExt = await getDiskExtensionById(extensionManager, cwd, id);
    if (!diskExt) throw ExtensionError.notFound('on disk');
    extensionName = diskExt.name;
  }

  if (!extensionName) {
    throw ExtensionError.invalidId();
  }

  // Resolve directory and manifest — directories are named by manifest.name
  const { dir: resolvedDir } =
    await extensionManager.resolveExtensionDir(extensionName);

  let manifest = null;
  if (resolvedDir) {
    manifest = await extensionManager.readManifest(resolvedDir);
  }

  if (!manifest) {
    throw ExtensionError.notFound(extensionName);
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
 * @param {string} id - Extension key (manifest.id)
 * @returns {Promise<string|null>} Extension static files directory path or null if invalid
 */
export async function getExtensionStaticDir(
  { extensionManager, models, cwd },
  id,
) {
  const { extension } = await resolveExtension(models, id, {
    required: false,
  });

  let extensionKey = extension ? extension.name : null;
  if (!extensionKey) {
    const diskExt = await getDiskExtensionById(extensionManager, cwd, id);
    if (!diskExt) return null;
    extensionKey = diskExt.name;
  }

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
    'xnapify-extension-install',
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

    if (
      !(await fs.promises
        .access(manifestPath)
        .then(() => true)
        .catch(() => false))
    ) {
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

    if (
      !(await fs.promises
        .access(manifestPath)
        .then(() => true)
        .catch(() => false))
    ) {
      throw ExtensionError.invalidPackage(
        'Invalid extension package: package.json not found. ' +
          'Ensure the zip contains package.json at the root, or in a single subdirectory.',
      );
    }

    const manifest = await extensionManager.readManifest(extensionRoot);
    if (!manifest) {
      throw ExtensionError.invalidPackage(
        'Invalid extension package: failed to parse package.json.',
      );
    }

    // 4. Validate manifest
    const { name: extensionName, version: extensionVersion } =
      validateManifest(manifest);

    // 5. Check for duplicate — reject if already installed
    const { extension: existingExtension } = await resolveExtension(
      models,
      manifest.id,
      { required: false },
    );
    if (existingExtension) {
      throw ExtensionError.conflict(
        `Extension "${manifest.id}" is already installed. ` +
          'Uninstall it first or use upgrade.',
      );
    }

    // 6. Move to final destination (use manifest.name for directory — supports @org/name)
    const finalExtensionDir = path.join(extensionsDir, extensionName);

    // Ensure parent scope directory exists for scoped names (e.g. @xnapify-extension/)
    await fs.promises.mkdir(path.dirname(finalExtensionDir), {
      recursive: true,
    });
    await fs.promises.rm(finalExtensionDir, { recursive: true, force: true });

    await fs.promises.rename(extensionRoot, finalExtensionDir);

    // 7. Create DB record — inactive by default (admin must manually activate)
    const extension = await Extension.create({
      key: manifest.id,
      name: extensionName,
      description: manifest.description,
      version: extensionVersion,
      is_active: false,
      options: {
        author: manifest.author,
        repository: manifest.repository,
      },
      integrity: null,
    });

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
 * @param {string} id - Extension key (manifest.id)
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
  let { extension } = await resolveExtension(models, id, {
    required: false,
  });

  // Canonical key: DB record's key, or raw ID for FS-only extensions
  const key = extension ? extension.key : id;

  // FS-only extension with no DB record yet — create one
  if (!extension && key && cwd) {
    const manifest = await getDiskExtensionById(extensionManager, cwd, key);

    if (!manifest) {
      throw ExtensionError.notFound('on disk');
    }

    const { name: extensionName, version: extensionVersion } =
      validateManifest(manifest);

    [extension] = await Extension.findOrCreate({
      where: { key },
      defaults: {
        name: extensionName,
        description: manifest.description || '',
        version: extensionVersion,
        is_active: isActive,
        integrity: null,
      },
    });
  }

  if (!extension) {
    throw ExtensionError.notFound();
  }

  // Resolve extension physical directory on disk — uses manifest name
  const { dir: extensionDir, isDevExtension } =
    await extensionManager.resolveExtensionDir(extension.name);

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
 * Upgrade extension metadata.
 * Nulls out integrity so next activation re-verifies.
 * @param {string} id - Extension key (manifest.id)
 * @param {Object} data - Update data (name, description, version)
 * @param {Object} context - App context
 */
export async function upgradeExtension(
  id,
  data,
  { models, cache, hook, actorId },
) {
  const { extension } = await resolveExtension(models, id);

  await extension.update({ ...data, integrity: null });
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
