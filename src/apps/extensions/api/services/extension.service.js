/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  isMissingFsError,
  resolveWithin,
  safeSegment,
} from '@shared/utils/atomic/index.js';

import {
  checksumMismatchReason,
  computeChecksum,
} from '../utils/checksum.util.js';

import {
  CACHE_TTL,
  ExtensionError,
  resolveExtension,
  validateManifest,
  invalidateCaches,
} from './extension.helpers.js';

// Cache for disk-only extensions
const diskExtensionCache = new Map();
let lastDiskScan = 0;
let diskScanPromise = null;
const DISK_SCAN_TTL = 30_000; // 30 seconds TTL — extension HMR triggers explicit invalidation

/**
 * Scan a directory and add extensions to the map.
 *
 * A directory that is not there holds no extensions, and saying so is the
 * whole answer — a machine with no local extensions directory is the normal
 * case. A directory that cannot be *read* is a different statement, and this
 * throws rather than making it: the callers reconcile what they find against
 * the database, and an EACCES or an EMFILE reported as "empty" tells them
 * every installed extension was uninstalled.
 *
 * @param {string} dirPath - Directory path
 * @param {string} source - Source of extensions ('remote' or 'local')
 * @param {Map} metadata - Map to store extensions
 * @param {object} extensionManager - Extension manager
 * @throws {Error} If a directory exists but could not be listed
 */
async function scanDirectory(dirPath, source, metadata, extensionManager) {
  if (!dirPath) return;

  let files;
  try {
    files = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    if (isMissingFsError(err)) return;
    throw err;
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
      } catch (err) {
        if (isMissingFsError(err)) return;
        throw err;
      }
      await Promise.all(
        scopeFiles.map(scopeDirent => processDirent(scopeDirent, dirent.name)),
      );
      return;
    }

    const manifestArgs = parentScope
      ? [dirPath, parentScope, dirent.name]
      : [dirPath, dirent.name];

    // `strict` closes the same door one level down from the readdir guard
    // above. readManifest answers null for *everything* that goes wrong, so an
    // EACCES or an EMFILE on package.json — and this scan reads every
    // extension's manifest through one unbounded Promise.all, so a large
    // install can exhaust the descriptor table by itself — arrives here
    // indistinguishable from "there is no extension in this directory".
    // manageExtensions reads that as uninstalled and deactivates the row.
    const manifest = await extensionManager.readManifest(...manifestArgs, {
      strict: true,
    });
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

  const now = Date.now();
  if (now - lastDiskScan < DISK_SCAN_TTL && diskExtensionCache.has(id)) {
    return diskExtensionCache.get(id);
  }

  if (!diskScanPromise) {
    diskScanPromise = (async () => {
      try {
        const installedExtensionsDir =
          extensionManager.getInstalledExtensionsDir();
        const localExtensionsDir = extensionManager.getDevExtensionsDir(cwd);

        const metadata = new Map();
        const scanTasks = [
          scanDirectory(
            installedExtensionsDir,
            'remote',
            metadata,
            extensionManager,
          ),
        ];

        if (
          localExtensionsDir &&
          localExtensionsDir !== installedExtensionsDir
        ) {
          scanTasks.push(
            scanDirectory(
              localExtensionsDir,
              'local',
              metadata,
              extensionManager,
            ),
          );
        }

        // Fallback: also scan build/extensions/ relative to project root.
        // In dev mode BUILD_DIR may be .cache/dev/ while extensions were
        // built to build/extensions/ from a prior production build.
        const buildExtDir = path.resolve(process.cwd(), 'build', 'extensions');
        if (
          buildExtDir !== localExtensionsDir &&
          buildExtDir !== installedExtensionsDir
        ) {
          scanTasks.push(
            scanDirectory(buildExtDir, 'local', metadata, extensionManager),
          );
        }

        const scans = await Promise.allSettled(scanTasks);
        const failed = scans.find(scan => scan.status === 'rejected');
        if (failed) {
          // A scan that could not read one of the directories saw a subset of
          // what is installed. Serving that is a wrong answer; caching it and
          // serving it for the next 30 seconds is the same wrong answer with
          // no way to retry, so the timestamp is left alone and the next call
          // scans again.
          console.warn(
            '[getDiskExtensionById] Extension scan incomplete, not caching',
            failed.reason,
          );
          return;
        }

        diskExtensionCache.clear();
        for (const [key, val] of metadata.entries()) {
          diskExtensionCache.set(key, val);
        }
        lastDiskScan = Date.now();
      } finally {
        diskScanPromise = null;
      }
    })();
  }

  await diskScanPromise;

  return diskExtensionCache.get(id) || null;
}

// ========================================================================
// Package Helpers
// ========================================================================

/**
 * Locate the extension root inside an extracted package.
 *
 * A published zip may put `package.json` at the top level, or nest it inside a
 * single wrapper directory (`package/`, `@scope/name/`, …). Walks down through
 * single-child directories until it finds one.
 *
 * Shared with the hub update path, which verifies a downloaded package before
 * it is allowed to replace a working installation.
 *
 * @param {string} extractDir - Directory the package was extracted into
 * @returns {Promise<string>} Absolute path to the directory holding package.json
 * @throws {ExtensionError} When no manifest is found
 */
export async function locateExtensionRoot(extractDir) {
  const hasManifest = dir =>
    fs.promises
      .access(path.join(dir, 'package.json'))
      .then(() => true)
      .catch(() => false);

  if (await hasManifest(extractDir)) return extractDir;

  let currentDir = extractDir;
  let depth = 0;
  while (currentDir && depth < 5) {
    depth++;
    let entries;
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      break;
    }
    const subdirs = entries.filter(d => d.isDirectory());

    if (depth === 1) {
      console.debug('[locateExtensionRoot] Extracted contents:', {
        currentDir,
        entries: entries.map(e => ({ name: e.name, isDir: e.isDirectory() })),
        subdirs: subdirs.map(d => d.name),
      });
    }

    if (subdirs.length !== 1) break;

    currentDir = path.join(currentDir, subdirs[0].name);
    if (await hasManifest(currentDir)) return currentDir;
  }

  throw ExtensionError.invalidPackage(
    'Invalid extension package: package.json not found. ' +
      'Ensure the zip contains package.json at the root, or in a single subdirectory.',
  );
}

// ========================================================================
// Service Functions
// ========================================================================

/**
 * Attach the live load state of each extension to a list entry.
 *
 * Deliberately applied *outside* the list cache: an extension that crashes
 * while booting never writes to the DB and never invalidates the cache, so a
 * cached `state: 'active'` would keep the admin UI claiming an extension is
 * healthy for the rest of the TTL — the exact failure this field exists to
 * surface. The expensive part (FS scan + DB merge) stays cached; only this
 * cheap in-memory lookup is redone on every read.
 *
 * @param {object} extensionManager - Extension manager
 * @param {Array} entries - Cached or freshly built list entries
 * @returns {Array} Entries with a fresh `runtime` block
 */
function withRuntimeState(extensionManager, entries) {
  return entries.map(entry => {
    const runtime = extensionManager.getExtensionMetadata(entry.id);
    return {
      ...entry,
      runtime: runtime
        ? {
            state: runtime.state,
            error: runtime.error ? runtime.error.message : null,
            loadedAt: runtime.loadedAt || null,
          }
        : { state: 'inactive', error: null, loadedAt: null },
    };
  });
}

/**
 * Attach each extension's live queue status.
 *
 * Per-request state, exactly like {@link withRuntimeState}: a job that is
 * pending now has finished a second later. Computing it before `cache.set`
 * froze "ACTIVATING" into a 60-second cache that nothing invalidates when the
 * job completes, so the admin UI kept rendering the pending badge long after
 * the toggle was done — and because the completion event also cancels the
 * client's safety timer, nothing ever re-checked. Returns copies, so a cached
 * entry is never stamped with a status that outlives the request.
 *
 * @param {Function|null} queue - Queue factory
 * @param {Array} entries - Extension entries
 * @returns {Promise<Array>} Entries with `job_status` where a job is live
 */
async function withJobStatus(queue, entries) {
  if (!queue) return entries;

  const queueChannel = queue('extensions');
  if (
    !queueChannel ||
    !queueChannel.queue ||
    typeof queueChannel.queue.getJobs !== 'function'
  ) {
    return entries;
  }

  const allJobs = await queueChannel.queue.getJobs();
  const busyJobs = allJobs.filter(j =>
    ['pending', 'active', 'delayed'].includes(j.status),
  );
  if (busyJobs.length === 0) return entries;

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
      statusByExtensionKey.set(path.basename(job.data.extensionDir), status);
  }

  return entries.map(entry => {
    const status =
      statusByExtensionKey.get(entry.id) ||
      statusByExtensionKey.get(entry.key) ||
      statusByExtensionKey.get(entry.name);
    return status ? { ...entry, job_status: status } : entry;
  });
}

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
  cache,
}) {
  const CACHE_KEY = 'extensions:list:all';

  if (cache) {
    const cached = await cache.get(CACHE_KEY);
    if (cached) {
      return withJobStatus(queue, withRuntimeState(extensionManager, cached));
    }
  }

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

  // Fallback: also scan build/extensions/ relative to project root.
  // In dev mode BUILD_DIR may be .cache/dev/ while extensions were
  // built to build/extensions/ from a prior production build.
  const buildExtDir = path.resolve(process.cwd(), 'build', 'extensions');
  if (
    buildExtDir !== localExtensionsDir &&
    buildExtDir !== installedExtensionsDir
  ) {
    scanTasks.push(
      scanDirectory(buildExtDir, 'local', metadata, extensionManager),
    );
  }

  const scans = await Promise.allSettled(scanTasks);
  // "Not on disk" is a claim about the whole filesystem, and step 2a acts on
  // it by deactivating the row. One unreadable directory makes the claim
  // unfounded for every extension that lives in it, so the sweep is held back
  // rather than run on partial evidence.
  const incompleteScan = scans.find(scan => scan.status === 'rejected');
  if (incompleteScan) {
    console.warn(
      '[manageExtensions] Extension scan incomplete — missing extensions will not be deactivated this pass',
      incompleteScan.reason,
    );
  }

  // 2. Fetch from DB
  const dbExtensions = await Extension.findAll();

  // `key` holds the extension's build-time id, which is derived from the
  // manifest name. Change how that derivation works and every row written by
  // an older build stops matching the manifest now on disk, so the row reads
  // as an extension the user deleted and the branch below deactivates it —
  // silently uninstalling working extensions on the next admin page load.
  // `name` is unique and never derived, so match on it as well and repair the
  // stale key instead.
  const fsByName = new Map();
  for (const entry of metadata.values()) {
    if (entry && entry.name) fsByName.set(entry.name, entry);
  }

  // Metadata keys claimed by a DB row, so 2b can tell a genuinely new
  // extension from one whose key was just repaired.
  const installedKeys = new Set();

  // 2a. Process DB extensions
  for (const dbExtension of dbExtensions) {
    let fsExtension = metadata.get(dbExtension.key);

    if (!fsExtension) {
      const byName = fsByName.get(dbExtension.name);
      if (byName && byName.id) {
        const staleKey = dbExtension.key;
        fsExtension = byName;
        try {
          await dbExtension.update({ key: byName.id });
          console.info(
            `[manageExtensions] Re-keyed ${dbExtension.name}: ${staleKey} -> ${byName.id}`,
          );
        } catch (err) {
          console.error(
            `[manageExtensions] Failed to re-key ${dbExtension.name} (${staleKey} -> ${byName.id})`,
            err,
          );
        }
      }
    }

    if (fsExtension) {
      installedKeys.add(fsExtension.id);
      // Extension exists in both DB and FS
      // Merge DB data into FS data. DB is the source of truth for status.
      metadata.set(fsExtension.id, {
        ...fsExtension,
        ...dbExtension.toJSON(),
        id: fsExtension.id,
        isActive: dbExtension.is_active,
        isInstalled: true,
        source: fsExtension.source === 'local' ? 'db+local' : 'db+remote',
      });
    } else if (incompleteScan) {
      // Left exactly as it is: a row this pass could not see is not a row the
      // user uninstalled, and deactivating it costs them a manual re-enable
      // for every extension, per failed scan.
      metadata.set(dbExtension.key, {
        ...dbExtension.toJSON(),
        id: dbExtension.key,
        isActive: dbExtension.is_active,
        isInstalled: true,
        source: 'db',
      });
      installedKeys.add(dbExtension.key);
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
    if (!installedKeys.has(key)) {
      metadata.set(key, {
        ...manifest,
        isInstalled: false,
        isActive: false,
        source: manifest.source,
      });
    }
  }

  // Convert Map to Array. The live runtime state is attached on the way out
  // (see withRuntimeState) so it is never served from the cache.
  for (const entry of metadata.values()) {
    extensions.push({
      ...entry,
      compatibility: entry.compatibility || null,
    });
  }

  console.debug(
    `[manageExtensions] Total extensions found: ${extensions.length}`,
  );

  if (cache) {
    await cache.set(CACHE_KEY, extensions, CACHE_TTL);
  }

  // Live state is attached AFTER the cache write, never before it.
  return withJobStatus(queue, withRuntimeState(extensionManager, extensions));
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

  // Canonical key: DB record's key, or raw ID for disk-only extensions.
  //
  // This becomes the directory the background delete worker removes
  // recursively, and with no matching DB row it is the raw route parameter —
  // so `../../something` handed `rm -rf` a target outside the extensions
  // directory entirely.
  //
  // Validated by containment rather than reduced to one segment: keys are
  // legitimately scoped (`@xnapify-extension/docs`), so collapsing to a single
  // segment would both break those and silently retarget `../../../etc` at an
  // unrelated extension called `etc`. Refusing is the only safe answer.
  const key = String(extension ? extension.key : (id ?? ''));
  const installedDir =
    typeof extensionManager?.getInstalledExtensionsDir === 'function'
      ? extensionManager.getInstalledExtensionsDir()
      : null;
  const baseDir = installedDir || '/extensions';
  try {
    const resolved = resolveWithin(baseDir, key);
    // resolveWithin permits the base itself — correct in general, wrong here:
    // a key of "." or "" resolves to the extensions directory, so the delete
    // worker would remove every installed extension rather than one.
    if (resolved === path.resolve(baseDir)) {
      throw new Error('key resolves to the extensions directory itself');
    }
  } catch {
    const error = new Error(`Invalid extension identifier: ${String(id)}`);
    error.name = 'ExtensionNotFoundError';
    error.statusCode = 400;
    throw error;
  }

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
    error.name = 'ExtensionActiveError';
    error.statusCode = 400;
    throw error;
  }

  // Enqueue the background deletion job
  if (queue && cwd) {
    const queueChannel = queue('extensions');
    // Awaited, because `emit` is async and this call *is* the deletion:
    // dropping the promise reports success for work that was never scheduled,
    // and a rejection with nobody attached is an unhandled rejection — which
    // on Node 20 takes the process down rather than the request.
    await queueChannel.emit('delete', {
      extensionKey: key,
      extensionName,
      actorId,
    });
  } else if (extension) {
    // Fallback if app context is missing: destroy DB record immediately
    await extension.destroy();
  }

  if (cache && extension) await invalidateCaches(cache, extension.key);

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
  // Fast path: resolve from in-memory extension metadata first.
  // This avoids a DB query on every static file request and prevents
  // "ConnectionManager.getConnection was called after the connection manager
  // was closed" errors during HMR full reloads (disposeApp drains the DB
  // pool while in-flight static asset requests are still pending).
  const metadata = extensionManager.getExtensionMetadata(id);
  if (metadata && metadata.manifest && metadata.manifest.name) {
    const { dir } = await extensionManager.resolveExtensionDir(
      metadata.manifest.name,
    );
    if (dir) return dir;
  }

  // Slow path: fall back to DB lookup (extension not yet loaded in memory)
  let extensionKey = null;
  try {
    const { extension } = await resolveExtension(models, id, {
      required: false,
    });
    extensionKey = extension ? extension.name : null;
  } catch {
    // DB may be unavailable during shutdown — continue to disk fallback
  }

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
 * Move a directory, falling back to copy-then-remove across filesystems.
 *
 * `rename` cannot cross a mount point: it returns EXDEV. Extraction happens in
 * `os.tmpdir()` and installation lands in the app tree, and this project ships
 * a docker-compose that puts those on separate volumes — so the fallback is the
 * normal path in production, not an exotic one.
 *
 * @param {string} source
 * @param {string} destination
 * @returns {Promise<void>}
 */
async function moveDirectory(source, destination) {
  try {
    await fs.promises.rename(source, destination);
    return;
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
  }

  // Copy first, and only drop the source once the copy is complete, so an
  // interruption leaves the extraction intact rather than losing both copies.
  await fs.promises.cp(source, destination, {
    recursive: true,
    force: true,
    errorOnExist: false,
  });
  await fs.promises
    .rm(source, { recursive: true, force: true })
    .catch(() => {});
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
  {
    extensionManager,
    models,
    cache,
    fs: fsEngine,
    actorId,
    queue,
    expectedChecksum,
  },
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
  // Unique per install, and reduced to a single safe segment.
  //
  // `path.parse('..').name` is `'..'`, so an upload literally named `..` made
  // this resolve to the system temp directory itself — which the cleanup below
  // then removes recursively. The random suffix is equally load-bearing: the
  // name alone is deterministic, so two concurrent installs of the same file
  // shared one directory and each one's cleanup deleted the other's in-flight
  // extraction.
  const tempExtractDir = path.join(
    os.tmpdir(),
    'xnapify-extension-install',
    `${safeSegment(file.originalname || '', { fallback: 'package' })}-` +
      `${process.pid.toString(36)}-${crypto.randomBytes(6).toString('hex')}`,
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
    //
    // The extractor never rejects on a per-entry failure: a write that hit
    // ENOSPC, a path it refused as zip-slip, an entry it skipped because the
    // target already existed — each is collected into `errors`/`skippedFiles`
    // and the call still resolves `{ success: true }`. Half an archive still
    // carries a valid package.json, so the manifest checks below pass, the tree
    // is installed, and the install worker then hashes it as the integrity
    // baseline — after which nothing downstream can tell a truncated extension
    // from a whole one. Completeness is only knowable from these lists.
    const extraction = await fsEngine.extract(tempPath, tempExtractDir);

    const reportsEntries =
      extraction &&
      Array.isArray(extraction.extractedFiles) &&
      Array.isArray(extraction.errors) &&
      Array.isArray(extraction.skippedFiles);
    if (!reportsEntries) {
      // An engine that does not report what it wrote is indistinguishable from
      // one that wrote nothing, so refuse rather than assume success.
      throw ExtensionError.invalidPackage(
        'Extraction result could not be verified; refusing to install an ' +
          'unchecked package.',
      );
    }

    // `tempExtractDir` is fresh and unique per install, so nothing legitimate
    // can already occupy an entry's path: a skip means the archive names the
    // same file twice, and is as much a reason to stop as an outright error.
    const badEntries = [...extraction.errors, ...extraction.skippedFiles];
    if (badEntries.length > 0) {
      const sample = badEntries
        .slice(0, 5)
        .map(entry => entry.fileName)
        .join(', ');
      throw ExtensionError.invalidPackage(
        `Extraction was incomplete: ${extraction.errors.length} entries ` +
          `failed and ${extraction.skippedFiles.length} were skipped ` +
          `(${sample}${badEntries.length > 5 ? ', …' : ''}). ` +
          'The package was not installed.',
      );
    }

    // 3. Read manifest (package.json)
    const extensionRoot = await locateExtensionRoot(tempExtractDir);

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
          'Uninstall it first.',
      );
    }

    // 5b. Verify checksum if provided (hub installs pass this from registry)
    if (expectedChecksum) {
      const actualChecksum = await computeChecksum(extensionRoot);
      const reason = checksumMismatchReason(expectedChecksum, actualChecksum);
      if (reason) {
        // Fails closed either way; only the explanation differs.
        throw ExtensionError.invalidPackage(
          `Checksum mismatch for "${extensionName}": ` +
            `expected ${expectedChecksum.slice(0, 12)}…, ` +
            `got ${actualChecksum.slice(0, 12)}…. ` +
            (reason === 'content'
              ? 'The extension may have been tampered with.'
              : 'The supplied checksum is in a format this server cannot ' +
                'verify — the package predates the current checksum ' +
                'version and must be republished.'),
        );
      }
    }

    // 6. Move to final destination (use manifest.name for directory — supports @org/name)
    //
    // `extensionName` comes out of the uploaded package's own manifest, so it is
    // attacker-controlled: a plain join would let `"name": "../../../etc"`
    // place the payload anywhere the process can write.
    const finalExtensionDir = resolveWithin(extensionsDir, extensionName);

    // Ensure parent scope directory exists for scoped names (e.g. @xnapify-extension/)
    await fs.promises.mkdir(path.dirname(finalExtensionDir), {
      recursive: true,
    });

    // Swap through a backup instead of deleting first.
    //
    // Removing the existing installation and *then* renaming leaves nothing at
    // all if the rename fails — and it does fail, predictably: `extensionRoot`
    // lives under os.tmpdir() while `extensionsDir` is in the app tree, and this
    // project's own docker-compose puts those on different mounts, where rename
    // returns EXDEV. An upgrade would uninstall the working version and stop.
    const backupDir =
      `${finalExtensionDir}.replaced-${process.pid.toString(36)}-` +
      `${crypto.randomBytes(4).toString('hex')}`;
    let backedUp = false;
    try {
      await fs.promises.rename(finalExtensionDir, backupDir);
      backedUp = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    try {
      await moveDirectory(extensionRoot, finalExtensionDir);
    } catch (error) {
      if (backedUp) {
        // A failed moveDirectory can still have populated the destination: it
        // falls back to copy-then-remove across mounts (EXDEV), which this
        // project's docker-compose makes the normal path, and a copy that dies
        // part way leaves a truncated tree behind. rename() refuses to replace
        // a non-empty directory — ENOTEMPTY — so restoring the backup on top of
        // that debris failed, leaving the truncated install live under the name
        // the loader reads and the only good copy orphaned under .replaced-.
        await fs.promises
          .rm(finalExtensionDir, { recursive: true, force: true })
          .catch(() => {});
        await fs.promises
          .rename(backupDir, finalExtensionDir)
          .catch(restoreErr => {
            console.error(
              `[installExtensionFromPackage] Install failed AND the previous ` +
                `installation could not be restored; it is preserved at ` +
                `${backupDir}: ${restoreErr.message}`,
            );
          });
      }
      throw error;
    }

    // 7. Create DB record — inactive by default (admin must manually activate)
    //
    // The backup is kept until this succeeds, on purpose: two cluster workers
    // installing the same new extension both pass the duplicate check at step 5
    // (neither has created its row yet), both reach here, and the loser's
    // Extension.create fails on the unique `key`/`name` constraint. Without a
    // backup to restore, that failure would leave the winner's directory
    // overwritten by the loser's tree with no DB row pointing at it — an
    // extension present on disk that manageExtensions can never re-adopt,
    // since 2a only re-keys a row whose *name* still matches (extension.service.js
    // fsByName lookup) and this row does not exist at all.
    let extension;
    try {
      extension = await Extension.create({
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
    } catch (createErr) {
      if (backedUp) {
        // finalExtensionDir now holds the tree this install just moved in, so
        // rename() cannot drop the backup back onto it directly — move the
        // failed install aside first, the same way the initial swap works.
        const failedDir =
          `${finalExtensionDir}.failed-${process.pid.toString(36)}-` +
          `${crypto.randomBytes(4).toString('hex')}`;
        try {
          await fs.promises.rename(finalExtensionDir, failedDir);
          await fs.promises.rename(backupDir, finalExtensionDir);
          await fs.promises
            .rm(failedDir, { recursive: true, force: true })
            .catch(() => {});
        } catch (restoreErr) {
          console.error(
            `[installExtensionFromPackage] Extension.create failed AND the ` +
              `previous installation could not be restored; the rejected ` +
              `install is at ${failedDir}, the previous version is preserved ` +
              `at ${backupDir}: ${restoreErr.message}`,
          );
        }
      } else if (createErr.name === 'SequelizeUniqueConstraintError') {
        // A unique-key rejection on the no-backup path is not a failed
        // install, it is a lost race: two workers passed the duplicate check
        // before either had a row, and this one lost. The winner's tree is
        // what now sits at finalExtensionDir, so removing it would delete a
        // successfully installed extension and leave the winner's row pointing
        // at nothing — and manageExtensions can only re-adopt a row whose tree
        // still exists.
        console.warn(
          `[installExtensionFromPackage] "${extensionName}" was installed ` +
            `concurrently by another worker; leaving its directory in place.`,
        );
      } else {
        // No prior version to restore — a rejected create means nothing
        // should be installed at all.
        await fs.promises
          .rm(finalExtensionDir, { recursive: true, force: true })
          .catch(() => {});
      }
      throw createErr;
    }

    await fs.promises
      .rm(backupDir, { recursive: true, force: true })
      .catch(() => {});

    // 7. Enqueue the heavy dependencies install and module reload
    const queueChannel = queue('extensions');
    queueChannel.emit('install', {
      extensionDir: finalExtensionDir,
      extensionKey: manifest.id,
      actorId,
    });

    if (cache) await invalidateCaches(cache);

    return extension;
  } catch (err) {
    console.error('Extension install error:', err);
    throw err;
  } finally {
    // Cleanup temp files. Each step is independent — one throwing (a
    // permissions error, a busy handle) must not skip the ones after it, or a
    // single stuck removal leaks every temp artifact this install touched.
    await fs.promises
      .rm(tempExtractDir, { recursive: true, force: true })
      .catch(cleanupErr => {
        console.warn(
          '[installExtensionFromPackage] Failed to remove temp extraction dir:',
          cleanupErr.message,
        );
      });

    // The upload middleware's custom multer storage sets `fileName`
    // (capital N, see shared/api/engines/fs/middlewares.js); `filename`
    // (lowercase) is the vanilla-multer disk-storage convention this codebase
    // never uses, so checking it here meant fsEngine.remove could never fire.
    if (file.fileName && fsEngine && typeof fsEngine.remove === 'function') {
      await fsEngine.remove(file.fileName).catch(cleanupErr => {
        console.warn(
          '[installExtensionFromPackage] Failed to remove uploaded file:',
          cleanupErr.message,
        );
      });
    }

    await fs.promises.unlink(tempPath).catch(() => {});
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

  if (cache) await invalidateCaches(cache, id);

  // Enqueue the background job for NPM dependencies and module reloading
  if (queue) {
    const queueChannel = queue('extensions');

    // Cancel any pending/delayed toggle jobs for this extension to prevent
    // stale jobs from overwriting the latest user intent during rapid toggling.
    if (
      queueChannel.queue &&
      typeof queueChannel.queue.getJobs === 'function'
    ) {
      try {
        const allJobs = await queueChannel.queue.getJobs();
        for (const job of allJobs) {
          if (
            job.name === 'toggle' &&
            job.data &&
            job.data.extensionKey === extension.key &&
            ['pending', 'delayed'].includes(job.status)
          ) {
            await queueChannel.queue.removeJob(job.id);
          }
        }
      } catch (cleanupErr) {
        // Non-fatal — log and proceed with the new job
        console.warn(
          `[toggleExtensionStatus] Failed to cancel stale toggle jobs for ${extension.key}:`,
          cleanupErr.message,
        );
      }
    }

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
 * Reloads extension configurations and invalidates API caches.
 *
 * @param {Array<string>} extensionIds - Optional list of specific extension IDs to isolate the refresh
 * @param {Object} context - App context holding DI modules
 */
export async function refreshExtensions(
  extensionIds = [],
  { extensionManager, cache, models },
) {
  const { Extension } = models;

  // Refresh extensions
  await extensionManager.refresh(...extensionIds);

  // If this is a global refresh, derive ALL existing extension keys from the DB
  // so we can systematically purge every possible individual detail cache `extensions:detail:*`
  const allExtensions = await Extension.findAll({
    attributes: ['key'],
  });
  await invalidateCaches(
    cache,
    ...new Set([...extensionIds, ...allExtensions.map(ext => ext.key)]),
  );
}
