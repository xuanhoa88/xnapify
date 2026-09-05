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

import {
  installExtensionFromPackage,
  deleteExtension,
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
 * Update an already-installed extension from the hub registry.
 *
 * Flow:
 *  1. Look up the extension in the remote registry.
 *  2. Verify it is already installed locally.
 *  3. Deactivate the extension if currently active.
 *  4. Delete the existing installation (DB + FS).
 *  5. Re-install the new version from the hub.
 *
 * This reuses the existing `deleteExtension()` and `installExtensionFromPackage()`
 * pipelines to maintain consistency with the core extension lifecycle.
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

  // 1. Deactivate if currently active (deleteExtension requires inactive state)
  if (existing.is_active) {
    await toggleExtensionStatus(existing.key, false, context);
  }

  // 2. Delete the existing installation — this removes the DB record and FS dir
  await deleteExtension(existing.key, context);

  // 3. Re-install the new version from hub
  const tmpPath = await downloadHubPackage(listing);

  try {
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

  // Broadcast to all authenticated sockets; the admin UI filters by permission.
  ws.sendToProtectedChannel('extension:updates_available', {
    type: 'UPDATES_AVAILABLE_COUNT',
    count: updateCount,
  });

  return updateCount;
}
