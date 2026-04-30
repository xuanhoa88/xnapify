/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import fetch from 'node-fetch';

import { installExtensionFromPackage } from './extension.service';

// ========================================================================
// Hub Service — GitHub Registry-backed Browse API
// ========================================================================

/**
 * Registry URL — configurable via env.
 * Points to the raw registry.json hosted on GitHub.
 */
const REGISTRY_URL = process.env.XNAPIFY_HUB_REGISTRY_URL || '';

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

  if (!REGISTRY_URL) {
    return { version: 1, updatedAt: null, extensions: [] };
  }

  try {
    const response = await fetch(REGISTRY_URL, {
      timeout: 10_000,
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
// Browse API
// ========================================================================

/**
 * Browse marketplace listings with search, filtering, sorting, and pagination.
 * Reads from the GitHub-hosted registry.json instead of the local DB.
 *
 * @param {Object} _deps - Unused (kept for controller signature compatibility)
 * @param {Object} params - { search, category, sort, page, limit }
 * @returns {Object} { listings, total, page, totalPages }
 */
export async function browseListings(_deps, params = {}) {
  const {
    search = '',
    category = '',
    sort = 'name',
    page = 1,
    limit = 20,
  } = params;

  const registry = await fetchRegistry();
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
      (b.version || '0.0.0').localeCompare(a.version || '0.0.0'),
    );
  }

  // Paginate
  const total = results.length;
  const offset = (Math.max(1, page) - 1) * limit;
  const clampedLimit = Math.min(limit, 100);
  const listings = results.slice(offset, offset + clampedLimit);

  return {
    listings,
    total,
    page: Math.max(1, page),
    totalPages: Math.ceil(total / clampedLimit) || 1,
  };
}

/**
 * Get featured listings (first N from the registry).
 *
 * @param {Object} _deps - Unused
 * @param {number} limit - Max results
 * @returns {Array} Featured listings
 */
export async function getFeaturedListings(_deps, limit = 10) {
  const registry = await fetchRegistry();
  return (registry.extensions || []).slice(0, limit);
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
 *
 * @param {Object} _deps - Unused
 * @param {string} name - Extension name (e.g., '@xnapify-extension/my-ext')
 * @returns {Object} Listing detail
 */
export async function getListingDetail(_deps, name) {
  const registry = await fetchRegistry();
  const listing = (registry.extensions || []).find(e => e.name === name);

  if (!listing) {
    const err = new Error('Listing not found');
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

  if (!listing.downloadUrl) {
    const err = new Error(
      `Extension "${extensionName}" has no download URL in registry`,
    );
    err.name = 'ExtensionDownloadUrlError';
    err.status = 400;
    throw err;
  }

  // Download the .zip to a temp file
  const response = await fetch(listing.downloadUrl, { timeout: 60_000 });
  if (!response.ok) {
    const err = new Error(
      `Failed to download ${extensionName} from hub registry: HTTP ${response.status}`,
    );
    err.name = 'ExtensionDownloadError';
    err.status = 502;
    throw err;
  }

  const tmpDir = path.join(os.tmpdir(), 'xnapify-hub-install');
  await fs.promises.mkdir(tmpDir, { recursive: true });

  const tmpPath = path.join(
    tmpDir,
    `${extensionName.replace(/\//g, '-')}-${Date.now()}.zip`,
  );

  // Stream the response body to disk
  const dest = fs.createWriteStream(tmpPath);
  await new Promise((resolve, reject) => {
    response.body.pipe(dest);
    response.body.on('error', reject);
    dest.on('finish', resolve);
  });

  try {
    // Delegate to the existing install pipeline
    const result = await installExtensionFromPackage(
      {
        path: tmpPath,
        originalname: `${extensionName.replace(/\//g, '-')}.zip`,
      },
      context,
    );
    return result;
  } finally {
    // Cleanup temp file (best-effort)
    fs.promises.unlink(tmpPath).catch(() => {});
  }
}
