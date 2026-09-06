/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import { Op } from 'sequelize';

import { computeChecksum } from '../utils/checksum.util.js';

import {
  installExtensionFromPackage,
  deleteExtension,
  locateExtensionRoot,
  toggleExtensionStatus,
} from './extension.service.js';

// ========================================================================
// Hub Service — GitHub Registry-backed Browse API
// ========================================================================

/**
 * In-memory cache for the remote registry to avoid
 * fetching on every browse request.
 */
let registryCache = null;
let registryCacheTime = 0;
const REGISTRY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fixed marketplace categories.
 */
const CATEGORIES = [
  { key: 'authentication', label: 'Authentication', icon: '🔐' },
  { key: 'communication', label: 'Communication', icon: '💬' },
  { key: 'analytics', label: 'Analytics', icon: '📊' },
  { key: 'productivity', label: 'Productivity', icon: '⚡' },
  { key: 'developer-tools', label: 'Developer Tools', icon: '🛠' },
  { key: 'content', label: 'Content', icon: '📝' },
  { key: 'social', label: 'Social', icon: '👥' },
  { key: 'security', label: 'Security', icon: '🛡' },
  { key: 'integration', label: 'Integration', icon: '🔗' },
  { key: 'other', label: 'Other', icon: '📦' },
];

// ========================================================================
// Registry Fetching
// ========================================================================

/**
 * Fetch the remote GitHub-hosted registry.json with in-memory caching.
 *
 * Returns the parsed registry object `{ version, updatedAt, extensions }`.
 * Returns a fallback empty registry when XNAPIFY_HUB_REGISTRY_URL is unset
 * or the fetch fails (graceful degradation).
 *
 * @returns {Promise<{ version: number, updatedAt: string, extensions: Array }>}
 */
async function fetchRegistry() {
  const now = Date.now();
  if (registryCache && now - registryCacheTime < REGISTRY_CACHE_TTL) {
    return registryCache;
  }

  if (!process.env.XNAPIFY_HUB_REGISTRY_URL) {
    return { version: 1, updatedAt: null, extensions: [] };
  }

  try {
    const response = await fetch(process.env.XNAPIFY_HUB_REGISTRY_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(
        `[HubService] Registry fetch failed: HTTP ${response.status}`,
      );
      // Return stale cache if available, otherwise empty
      return registryCache || { version: 1, updatedAt: null, extensions: [] };
    }

    const data = await response.json();
    registryCache = data;
    registryCacheTime = Date.now();
    return data;
  } catch (err) {
    console.warn(`[HubService] Registry fetch error: ${err.message}`);
    return registryCache || { version: 1, updatedAt: null, extensions: [] };
  }
}

/**
 * Invalidate the in-memory registry cache.
 * Called after install to force re-fetch on next browse.
 */
export function invalidateRegistryCache() {
  registryCache = null;
  registryCacheTime = 0;
}

// ========================================================================
// Helpers
// ========================================================================

/**
 * Build a Map of locally installed extensions keyed by their DB `key`.
 * Used to enrich hub listings with install status.
 *
 * @param {Object} models - Sequelize models ({ Extension })
 * @returns {Promise<Map<string, { version: string, is_active: boolean }>>}
 */
async function getInstalledExtensionsMap(models) {
  if (!models) return new Map();
  const { Extension } = models;
  const rows = await Extension.findAll({
    attributes: ['key', 'version', 'is_active'],
  });
  const map = new Map();
  for (const row of rows) {
    map.set(row.key, { version: row.version, isActive: row.is_active });
  }
  return map;
}

/**
 * Enrich a hub listing with local installation status.
 *
 * Adds: `installed`, `installedVersion`, `isActive`, `updateAvailable`.
 *
 * @param {Object} listing - Raw hub listing from registry
 * @param {Map} installedMap - Map from getInstalledExtensionsMap()
 * @returns {Object} Enriched listing
 */
function enrichListing(listing, installedMap) {
  const local = installedMap.get(listing.key) || null;
  return {
    ...listing,
    installed: !!local,
    installedVersion: local ? local.version : null,
    isActive: local ? local.isActive : false,
    updateAvailable: local ? listing.version !== local.version : false,
  };
}

// ========================================================================
// Browse API
// ========================================================================

/**
 * Browse marketplace listings with search, filtering, sorting, and pagination.
 * Reads from the GitHub-hosted registry.json instead of the local DB.
 * Cross-references with local DB to show install status.
 *
 * @param {Object} deps - { models }
 * @param {Object} params - { search, category, sort, page, limit }
 * @returns {Object} { listings, total, page, totalPages }
 */
export async function browseListings(deps, params = {}) {
  const {
    search = '',
    category = '',
    sort = 'name',
    page = 1,
    limit = 20,
  } = params;

  const [registry, installedMap] = await Promise.all([
    fetchRegistry(),
    getInstalledExtensionsMap(deps.models),
  ]);
  let results = [...(registry.extensions || [])];

  // Filter by category
  if (category && category !== 'all') {
    results = results.filter(e => e.category === category);
  }

  // Search across name, description, short_description, tags
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      e =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.short_description || '').toLowerCase().includes(q) ||
        (Array.isArray(e.tags) &&
          e.tags.some(t => t.toLowerCase().includes(q))),
    );
  }

  // Sort
  if (sort === 'name') {
    results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sort === 'recent') {
    // Extensions don't have install_count in GitHub registry,
    // sort by version as a proxy for recency
    results.sort((a, b) =>
      (b.version || '1.0.0').localeCompare(a.version || '1.0.0'),
    );
  }

  // Paginate
  const total = results.length;
  const offset = (Math.max(1, page) - 1) * limit;
  const clampedLimit = Math.min(limit, 100);
  const listings = results
    .slice(offset, offset + clampedLimit)
    .map(l => enrichListing(l, installedMap));

  return {
    listings,
    total,
    page: Math.max(1, page),
    totalPages: Math.ceil(total / clampedLimit) || 1,
  };
}

/**
 * Get featured listings from the registry.
 * Filters extensions that have `featured: true` in their metadata.
 * Cross-references with local DB to show install status.
 *
 * @param {Object} deps - { models }
 * @param {number} limit - Max results
 * @returns {Array} Featured listings enriched with install status
 */
export async function getFeaturedListings(deps, limit = 10) {
  const [registry, installedMap] = await Promise.all([
    fetchRegistry(),
    getInstalledExtensionsMap(deps.models),
  ]);
  const extensions = registry.extensions || [];
  const featured = extensions
    .filter(e => e.featured === true && !e.deprecated)
    .slice(0, limit)
    .map(l => enrichListing(l, installedMap));
  return featured;
}

/**
 * Get categories with listing counts from the registry.
 *
 * @param {Object} _deps - Unused
 * @returns {Array} Categories with counts
 */
export async function getCategories(_deps) {
  const registry = await fetchRegistry();
  const extensions = registry.extensions || [];

  const countMap = {};
  for (const ext of extensions) {
    const cat = ext.category || 'other';
    countMap[cat] = (countMap[cat] || 0) + 1;
  }

  return CATEGORIES.map(cat => ({
    ...cat,
    count: countMap[cat.key] || 0,
  }));
}

/**
 * Get listing detail by name from the registry.
 * Cross-references with local DB to show install status.
 *
 * @param {Object} deps - { models }
 * @param {string} name - Extension name (e.g., '@xnapify-extension/my-ext')
 * @returns {Object} Listing detail enriched with install status
 */
export async function getListingDetail(deps, name) {
  const [registry, installedMap] = await Promise.all([
    fetchRegistry(),
    getInstalledExtensionsMap(deps.models),
  ]);
  const listing = (registry.extensions || []).find(e => e.name === name);

  if (!listing) {
    const err = new Error('Listing not found');
    err.name = 'ExtensionNotFoundError';
    err.status = 404;
    throw err;
  }

  return enrichListing(listing, installedMap);
}

// ========================================================================
// Shared Download Helper
// ========================================================================

/**
 * Download a .zip from the hub registry to a temp file.
 *
 * @param {Object} listing - Registry listing with `downloadUrl` and `name`
 * @returns {Promise<string>} Absolute path to the downloaded temp file
 */
async function downloadHubPackage(listing) {
  if (!listing.downloadUrl) {
    const err = new Error(
      `Extension "${listing.name}" has no download URL in registry`,
    );
    err.name = 'ExtensionDownloadUrlError';
    err.status = 400;
    throw err;
  }

  if (!listing.checksum) {
    const err = new Error(
      `Extension "${listing.name}" has no checksum in registry — refusing to install unverified package`,
    );
    err.name = 'ExtensionChecksumMissingError';
    err.status = 400;
    throw err;
  }

  const response = await fetch(listing.downloadUrl, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok || !response.body) {
    const err = new Error(
      `Failed to download ${listing.name} from hub registry: HTTP ${response.status}`,
    );
    err.name = 'ExtensionDownloadError';
    err.status = 502;
    throw err;
  }

  const tmpDir = path.join(os.tmpdir(), 'xnapify-hub-install');
  await fs.promises.mkdir(tmpDir, { recursive: true });

  const tmpPath = path.join(
    tmpDir,
    `${listing.name.replace(/\//g, '-')}-${Date.now()}.zip`,
  );

  // Stream the response body to disk. Native fetch returns a WHATWG
  // ReadableStream (no .pipe), so convert it to a Node stream first.
  try {
    await pipeline(
      Readable.fromWeb(response.body),
      fs.createWriteStream(tmpPath),
    );
  } catch (err) {
    await fs.promises.unlink(tmpPath).catch(() => {});
    throw err;
  }

  return tmpPath;
}

/**
 * Look up a registry listing by name. Throws 404 if not found.
 *
 * @param {string} extensionName - Extension name
 * @returns {Promise<Object>} Registry listing
 */
async function resolveHubListing(extensionName) {
  const registry = await fetchRegistry();
  const listing = (registry.extensions || []).find(
    e => e.name === extensionName,
  );

  if (!listing) {
    const err = new Error(
      `Extension "${extensionName}" not found in hub registry`,
    );
    err.name = 'ExtensionNotFoundError';
    err.status = 404;
    throw err;
  }

  return listing;
}

// ========================================================================
// Install from Hub
// ========================================================================

/**
 * Install an extension directly from the GitHub hub registry.
 *
 * 1. Looks up the extension by name in the remote registry.
 * 2. Downloads the .zip from the extension's `downloadUrl`.
 * 3. Delegates to the existing `installExtensionFromPackage()` pipeline
 *    (extract → validate manifest → npm install → checksum → queue).
 *
 * @param {string} extensionName - Extension name from registry (e.g., '@xnapify-extension/my-ext')
 * @param {Object} context - App context (extensionManager, models, cache, fs, actorId, queue)
 * @returns {Promise<Object>} Installed extension record
 */
export async function installFromHub(extensionName, context) {
  const listing = await resolveHubListing(extensionName);

  // Guard: reject deprecated extensions
  if (listing.deprecated) {
    const err = new Error(
      `Extension "${extensionName}" is deprecated and can no longer be installed.`,
    );
    err.name = 'ExtensionDeprecatedError';
    err.status = 400;
    throw err;
  }

  const tmpPath = await downloadHubPackage(listing);

  try {
    // Delegate to the existing install pipeline, passing the expected
    // checksum from the hub registry for post-install verification
    const result = await installExtensionFromPackage(
      {
        path: tmpPath,
        originalname: `${extensionName.replace(/\//g, '-')}.zip`,
      },
      {
        ...context,
        expectedChecksum: listing.checksum,
      },
    );

    invalidateRegistryCache();

    try {
      await recalculateUpdateCount(context);
    } catch (err) {
      // Ignore background badge recalculation errors
    }
    return result;
  } finally {
    // Cleanup temp file (best-effort)
    fs.promises.unlink(tmpPath).catch(() => {});
  }
}

// ========================================================================
// Update from Hub
// ========================================================================

/**
 * Extract a downloaded hub package to a scratch directory and check it against
 * the checksum the registry advertised.
 *
 * `installExtensionFromPackage()` performs the same check, but only *after*
 * the previous installation has been removed. An update must know the
 * replacement is good while the working copy is still on disk.
 *
 * @param {string} packagePath - Downloaded .zip
 * @param {Object} listing - Registry listing (must carry `checksum`)
 * @param {Object} context - App context ({ fs })
 * @returns {Promise<void>}
 */
async function verifyHubPackage(packagePath, listing, { fs: fsEngine }) {
  if (!fsEngine || typeof fsEngine.extract !== 'function') {
    const err = new Error(
      'FS engine required to verify a hub package before installing',
    );
    err.name = 'ExtensionPackageError';
    err.status = 500;
    throw err;
  }

  const scratchDir = path.join(
    os.tmpdir(),
    'xnapify-hub-verify',
    `${listing.name.replace(/\//g, '-')}-${Date.now()}`,
  );

  try {
    await fs.promises.mkdir(path.dirname(scratchDir), { recursive: true });
    await fsEngine.extract(packagePath, scratchDir);

    const root = await locateExtensionRoot(scratchDir);
    const actual = await computeChecksum(root);

    if (actual !== listing.checksum) {
      const err = new Error(
        `Checksum mismatch for "${listing.name}": ` +
          `expected ${String(listing.checksum).slice(0, 12)}…, ` +
          `got ${actual.slice(0, 12)}…. ` +
          'The registry entry is stale or the package was tampered with.',
      );
      err.name = 'ExtensionChecksumMismatchError';
      err.status = 400;
      throw err;
    }
  } finally {
    await fs.promises
      .rm(scratchDir, { recursive: true, force: true })
      .catch(() => {});
  }
}

/**
 * Copy the installed extension aside so a failed swap can be undone.
 *
 * @param {Object} extension - Extension DB row
 * @param {Object} context - App context ({ extensionManager })
 * @returns {Promise<{ record: Object, sourceDir: string|null, backupDir: string|null }>}
 */
async function snapshotExtension(extension, { extensionManager }) {
  const snapshot = {
    record: extension.toJSON(),
    sourceDir: null,
    backupDir: null,
  };

  try {
    const { dir } = await extensionManager.resolveExtensionDir(extension.name);
    if (!dir) return snapshot;

    const backupDir = path.join(
      os.tmpdir(),
      'xnapify-hub-rollback',
      `${extension.key}-${Date.now()}`,
    );
    await fs.promises.mkdir(path.dirname(backupDir), { recursive: true });
    await fs.promises.cp(dir, backupDir, { recursive: true });

    snapshot.sourceDir = dir;
    snapshot.backupDir = backupDir;
  } catch (err) {
    console.warn(
      `[HubService] Could not snapshot ${extension.name} before update: ${err.message}`,
    );
  }

  return snapshot;
}

/**
 * Put back what {@link snapshotExtension} saved. Best effort: the uninstall
 * job runs on the background queue, so a restore issued while that job is
 * still in flight can be undone by it. The extension always comes back
 * inactive — its files are on disk again, and the admin re-activates it.
 *
 * @param {Object} snapshot - Result of snapshotExtension()
 * @param {Object} context - App context ({ models, cache })
 */
async function restoreExtension(snapshot, { models, cache }) {
  const { record, sourceDir, backupDir } = snapshot;

  if (sourceDir && backupDir) {
    try {
      await fs.promises.rm(sourceDir, { recursive: true, force: true });
      await fs.promises.mkdir(path.dirname(sourceDir), { recursive: true });
      await fs.promises.cp(backupDir, sourceDir, { recursive: true });
    } catch (err) {
      console.error(
        `[HubService] Failed to restore extension files for ${record.name}: ${err.message}`,
      );
    }
  }

  try {
    const { Extension } = models;
    const [row, created] = await Extension.findOrCreate({
      where: { key: record.key },
      defaults: { ...record, is_active: false },
    });
    if (!created) {
      await row.update({ ...record, is_active: false });
    }
  } catch (err) {
    console.error(
      `[HubService] Failed to restore extension record for ${record.name}: ${err.message}`,
    );
  }

  if (cache) {
    try {
      await cache.delete('extensions:list:all');
      await cache.delete('extensions:list:active');
    } catch {
      // Cache is best-effort
    }
  }
}

/**
 * Update an already-installed extension from the hub registry.
 *
 * Flow:
 *  1. Look up the extension in the remote registry.
 *  2. Verify it is already installed locally.
 *  3. Download the replacement and check it against the registry checksum.
 *  4. Snapshot the working installation.
 *  5. Deactivate, delete (DB + FS) and install the new version.
 *  6. Restore the snapshot if step 5 fails.
 *
 * Steps 3 and 4 are what stop a stale registry entry from uninstalling a
 * working extension: the download is refused outright when the entry carries
 * no checksum, and a checksum that no longer matches the published package is
 * rejected while the old files are still in place.
 *
 * @param {string} extensionName - Extension name from registry
 * @param {Object} context - App context
 * @returns {Promise<Object>} New extension record after update
 */
export async function updateFromHub(extensionName, context) {
  const listing = await resolveHubListing(extensionName);

  // Guard: reject deprecated extensions
  if (listing.deprecated) {
    const err = new Error(
      `Extension "${extensionName}" is deprecated and can no longer be updated.`,
    );
    err.name = 'ExtensionDeprecatedError';
    err.status = 400;
    throw err;
  }

  const { Extension } = context.models;
  const existing = await Extension.findOne({
    where: { key: listing.key || extensionName },
  });

  if (!existing) {
    const err = new Error(
      `Extension "${extensionName}" is not installed. Use install instead.`,
    );
    err.name = 'ExtensionNotInstalledError';
    err.status = 400;
    throw err;
  }

  // 1. Fetch and verify the replacement while the current install is intact.
  const tmpPath = await downloadHubPackage(listing);

  try {
    await verifyHubPackage(tmpPath, listing, context);

    // 2. Snapshot so a failed swap can be rolled back.
    const snapshot = await snapshotExtension(existing, context);

    try {
      // 3. Deactivate if active (deleteExtension requires inactive state)
      if (existing.is_active) {
        await toggleExtensionStatus(existing.key, false, context);
      }

      // 4. Delete the existing installation (DB record + FS dir)
      await deleteExtension(existing.key, context);

      // 5. Install the verified replacement
      const result = await installExtensionFromPackage(
        {
          path: tmpPath,
          originalname: `${extensionName.replace(/\//g, '-')}.zip`,
        },
        {
          ...context,
          expectedChecksum: listing.checksum,
        },
      );

      invalidateRegistryCache();
      // Post-update: Re-calculate the global updates badge count
      try {
        await recalculateUpdateCount(context);
      } catch (err) {
        // Ignore background badge recalculation errors
      }
      return result;
    } catch (err) {
      console.error(
        `[HubService] Update failed for ${extensionName} — restoring previous version:`,
        err.message,
      );
      await restoreExtension(snapshot, context);
      throw err;
    } finally {
      if (snapshot.backupDir) {
        await fs.promises
          .rm(snapshot.backupDir, { recursive: true, force: true })
          .catch(() => {});
      }
    }
  } finally {
    fs.promises.unlink(tmpPath).catch(() => {});
  }
}

// ========================================================================
// Uninstall from Hub
// ========================================================================

/**
 * Uninstall a hub-installed extension.
 *
 * Delegates to the existing `deleteExtension()` pipeline which handles:
 *  - Deactivation guard (must be inactive to delete)
 *  - DB record removal
 *  - FS directory cleanup
 *  - Cache invalidation
 *
 * @param {string} extensionName - Extension name from registry
 * @param {Object} context - App context
 * @returns {Promise<boolean>} True on success
 */
export async function uninstallFromHub(extensionName, context) {
  const listing = await resolveHubListing(extensionName);

  const { Extension } = context.models;
  const existing = await Extension.findOne({
    where: { key: listing.key || extensionName },
  });

  if (!existing) {
    const err = new Error(`Extension "${extensionName}" is not installed.`);
    err.name = 'ExtensionNotInstalledError';
    err.status = 400;
    throw err;
  }

  // Deactivate if currently active (deleteExtension requires inactive state)
  if (existing.is_active) {
    await toggleExtensionStatus(existing.key, false, context);
  }

  await deleteExtension(existing.key, context);
  invalidateRegistryCache();

  try {
    await recalculateUpdateCount(context);
  } catch (err) {
    // Ignore background badge recalculation errors
  }
  return true;
}

// ========================================================================
// Update Badge synchronization
// ========================================================================

/** Permission that gates the extension hub, and so the update badge. */
const UPDATE_BADGE_PERMISSION = { resource: 'extensions', action: 'read' };

/**
 * Ids of the users allowed to see the update badge.
 *
 * Resolved from RBAC rather than from the socket: the protected channel holds
 * every authenticated connection, so anything published there is readable by
 * any logged-in user. Wildcard grants (`*:*`, `extensions:*`, `*:read`) count,
 * matching `hasPermission()` in the auth engine.
 *
 * Returns null when the RBAC models are unavailable, which callers treat as
 * "send to nobody" — failing closed is the point of the exercise.
 *
 * @param {Object} models - Sequelize model registry
 * @returns {Promise<string[]|null>}
 */
async function findUsersWithUpdateBadgePermission(models) {
  const { User, Role, Group, Permission } = models || {};
  if (!User || !Role || !Group || !Permission) return null;

  const roles = await Role.findAll({
    attributes: ['id'],
    include: [
      {
        model: Permission,
        as: 'permissions',
        attributes: [],
        required: true,
        through: { attributes: [] },
        where: {
          is_active: true,
          resource: { [Op.in]: [UPDATE_BADGE_PERMISSION.resource, '*'] },
          action: { [Op.in]: [UPDATE_BADGE_PERMISSION.action, '*'] },
        },
      },
    ],
  });

  const roleIds = roles.map(role => role.id);
  if (roleIds.length === 0) return [];

  const roleFilter = {
    model: Role,
    as: 'roles',
    attributes: [],
    required: true,
    through: { attributes: [] },
    where: { id: { [Op.in]: roleIds } },
  };

  const [direct, viaGroups] = await Promise.all([
    User.findAll({ attributes: ['id'], include: [roleFilter] }),
    User.findAll({
      attributes: ['id'],
      include: [
        {
          model: Group,
          as: 'groups',
          attributes: [],
          required: true,
          through: { attributes: [] },
          include: [roleFilter],
        },
      ],
    }),
  ]);

  return [...new Set([...direct, ...viaGroups].map(user => user.id))];
}

/**
 * Push the update count to the users who are allowed to act on it.
 *
 * @param {Object} ws - WebSocket server
 * @param {Object} models - Sequelize model registry
 * @param {number} updateCount - Number of pending updates
 * @returns {Promise<number>} Recipients addressed
 */
async function broadcastUpdateCount(ws, models, updateCount) {
  let recipients;
  try {
    recipients = await findUsersWithUpdateBadgePermission(models);
  } catch (err) {
    console.warn(
      `[HubService] Could not resolve update badge recipients: ${err.message}`,
    );
    return 0;
  }

  if (!recipients || recipients.length === 0) return 0;

  const payload = { type: 'UPDATES_AVAILABLE_COUNT', count: updateCount };
  for (const userId of recipients) {
    ws.sendToPrivateChannel(userId, 'extension:updates_available', payload);
  }

  return recipients.length;
}

/**
 * Re-calculate the available updates count and broadcast via WebSockets.
 * Called by the background cron job and immediately after a successful update/uninstall.
 *
 * @param {Object} context - App context { models, cache, ws }
 */
export async function recalculateUpdateCount(context) {
  const { models, cache, ws } = context;
  if (!models || !cache || !ws) return;

  const [registry, installedMap] = await Promise.all([
    fetchRegistry(),
    getInstalledExtensionsMap(models),
  ]);

  const hubByKey = new Map(
    (registry.extensions || []).map(ext => [ext.key, ext]),
  );

  let updateCount = 0;
  for (const [key, local] of installedMap) {
    const hubExt = hubByKey.get(key);
    if (
      hubExt &&
      !hubExt.deprecated &&
      hubExt.version &&
      hubExt.version !== local.version
    ) {
      updateCount++;
    }
  }

  await cache.set('extension_update_count', updateCount, 3600 * 24);

  await broadcastUpdateCount(ws, models, updateCount);

  return updateCount;
}
