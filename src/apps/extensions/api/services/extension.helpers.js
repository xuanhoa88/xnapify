/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import { checkHostCompatibility } from '@shared/extension/utils/compat.js';

// Promisify execFile
const execFileAsync = promisify(execFile);

// Cache for extension list
export const CACHE_TTL = 60 * 1000; // 1 minute

// ========================================================================
// Extension Error
// ========================================================================

/**
 * Custom error class for extension operations.
 * Provides typed factory methods for consistent error handling.
 */
export class ExtensionError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} name - Error name/type
   * @param {number} status - HTTP status code
   */
  constructor(message, name, status) {
    super(message);
    this.name = name;
    this.status = status;
  }

  static notFound(detail = '') {
    return new ExtensionError(
      detail ? `Extension not found: ${detail}` : 'Extension not found',
      'ExtensionNotFound',
      404,
    );
  }

  static invalidId() {
    return new ExtensionError(
      'Invalid extension ID',
      'InvalidExtensionId',
      400,
    );
  }

  static invalidPackage(message) {
    return new ExtensionError(
      message || 'Invalid extension package',
      'InvalidExtensionPackage',
      400,
    );
  }

  static conflict(message) {
    return new ExtensionError(
      message || 'Extension already exists',
      'ExtensionConflict',
      409,
    );
  }

  static incompatible(reason) {
    return new ExtensionError(
      `Extension is not compatible with this host: ${reason}`,
      'IncompatibleExtension',
      422,
    );
  }
}

// ========================================================================
// Extension Resolution (DRY — used by 4 service functions)
// ========================================================================
/**
 * Resolve an extension record by its canonical key (manifest.id = DB `key`).
 *
 * @param {Object} models - Sequelize models ({ Extension })
 * @param {string} id - Extension key (manifest.id)
 * @param {Object} [options]
 * @param {boolean} [options.required=true] - Throw if not found
 * @returns {Promise<{extension: Object|null}>}
 */
export async function resolveExtension(models, id, { required = true } = {}) {
  const { Extension } = models;

  const extension = await Extension.findOne({ where: { key: id } });

  if (!extension && required) {
    throw ExtensionError.notFound();
  }

  return { extension };
}

// ========================================================================
// Manifest Validation (DRY — used by 2 service functions)
// ========================================================================

/**
 * One path segment of an extension name: must start with a letter or digit, so
 * "." and ".." cannot qualify, and may then carry the punctuation npm allows.
 */
const SAFE_NAME_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Validate a parsed extension manifest (requires name + version).
 *
 * @param {Object} manifest - Parsed package.json content
 * @returns {{ name: string, version: string }} Validated fields
 * @throws {ExtensionError} If name or version is missing/empty
 */
export function validateManifest(manifest) {
  const name =
    (typeof manifest.name === 'string' && manifest.name.trim()) || '';
  const version =
    (typeof manifest.version === 'string' && manifest.version.trim()) ||
    '1.0.0';

  if (name.length === 0 || version.length === 0) {
    throw ExtensionError.invalidPackage(
      'Invalid extension manifest: missing required fields (name, version)',
    );
  }

  // Security: prevent path traversal
  // Allow scoped names (exactly one '/' after '@'), block everything else
  const isScopedName =
    name.startsWith('@') &&
    name.indexOf('/') === name.lastIndexOf('/') &&
    name.indexOf('/') > 1;

  if (
    name.includes('..') ||
    name.includes('\\') ||
    (!isScopedName && name.includes('/'))
  ) {
    throw ExtensionError.invalidPackage(
      `Extension name "${name}" contains invalid path characters`,
    );
  }

  // Rejecting traversal is not enough, because the dangerous names here do not
  // traverse anywhere. "." and "@scope/." contain no "..", no backslash, and
  // parse as a well-formed scoped name, yet neither denotes a leaf: the first
  // resolves to the extensions root itself and the second to an entire scope
  // directory. `resolveWithin` accepts both — they really are inside the root.
  // The installer then renames whatever that path denotes aside as its backup
  // and, if the DB insert fails, rm -rf's it, so one uploaded package would
  // destroy every installed extension. Require each segment to be a real name.
  const segments = isScopedName
    ? [name.slice(1, name.indexOf('/')), name.slice(name.indexOf('/') + 1)]
    : [name];

  if (segments.some(segment => !SAFE_NAME_SEGMENT.test(segment))) {
    throw ExtensionError.invalidPackage(
      `Extension name "${name}" is not a usable directory name`,
    );
  }

  // Host version contract — an extension built for another major must not
  // be installed or activated.
  const compatibility = checkHostCompatibility(manifest);
  if (!compatibility.ok) {
    throw ExtensionError.incompatible(compatibility.reason);
  }

  return { name, version, compatibility };
}

// ========================================================================
// Cache Invalidation
// ========================================================================

/**
 * Invalidate extension caches
 * @param {object} cache - Cache engine instance
 * @param {...string} extensionIds - Optional extension ID to invalidate detail cache
 */
export async function invalidateCaches(cache, ...extensionIds) {
  if (cache) {
    const keys = ['extensions:list:all', 'extensions:list:active'];
    extensionIds.forEach(extensionId => {
      keys.push(`extensions:detail:${extensionId}`);
    });
    await Promise.all(keys.map(k => cache.delete(k)));
  }
}

// ========================================================================
// NPM Dependency Helpers
// ========================================================================

/**
 * Install extension dependencies
 * @param {string} extensionDir - Extension directory path
 * @param {object} extension - Extension object (needs .name for error messages)
 */
export async function installExtensionDependencies(extensionDir, extension) {
  try {
    if (__DEV__) {
      console.log(`[ExtensionService] Running npm install in ${extensionDir}`);
    }
    await execFileAsync(
      'npm',
      [
        'install',
        '--omit=dev',
        '--no-audit',
        '--no-update-notifier',
        '--no-fund',
        '--engine-strict',
        // No '--no-package-lock': an extension that ships a package-lock.json
        // gets exactly the tree its publisher tested, instead of re-resolving
        // ranges like ^1.13.0 on every install. npm falls back to resolving
        // the declared ranges (and writes the resulting lockfile) when the
        // package ships none. The lockfile is excluded from the integrity
        // hash, so writing one never invalidates an installed extension.
        // Never execute lifecycle scripts from third-party packages inside
        // the server process — extension code runs only through the
        // sandboxed lifecycle hooks, not via npm preinstall/postinstall.
        '--ignore-scripts',
      ],
      {
        cwd: extensionDir,
      },
    );
    if (__DEV__) {
      console.log('[ExtensionService] npm install completed successfully');
    }
  } catch (npmErr) {
    console.error('[ExtensionService] npm install failed:', npmErr);
    const extensionName =
      (extension && extension.name) || path.basename(extensionDir);
    const err = new Error(
      `Failed to install dependencies for extension ${extensionName}`,
    );
    err.name = 'ExtensionDependencyError';
    err.status = 500;
    throw err;
  }
}

// ========================================================================
// WebSocket Notification Helper
// ========================================================================

/**
 * Send a extension change notification over WebSocket.
 * Includes manifest data for EXTENSION_INSTALLED / EXTENSION_UPDATED so the
 * client-side extensionManager can inject CSS/JS tags.
 *
 * @param {Object} container - DI container instance
 * @param {string} type - Event type (EXTENSION_INSTALLED, EXTENSION_UPDATED, EXTENSION_UNINSTALLED, EXTENSION_TAMPERED)
 * @param {string} extensionKey - Extension manifest name (canonical key)
 * @param {string} [extensionId] - Optional DB UUID (for manifest lookup)
 */
export function notifyExtensionChange(container, type, extensionKey) {
  const ws = container.resolve('ws');
  if (!ws) return;

  // Use extensionKey (manifest.id) as the canonical identifier
  const payload = { type, extensionId: extensionKey };

  // Include manifest data for install/update/activate events
  if (
    type === 'EXTENSION_INSTALLED' ||
    type === 'EXTENSION_UPDATED' ||
    type === 'EXTENSION_ACTIVATED'
  ) {
    const extensionManager = container.resolve('extension');
    const metadata = extensionManager
      ? extensionManager.getExtensionMetadata(extensionKey)
      : null;
    payload.data = {
      manifest:
        metadata && metadata.manifest
          ? {
              hasClientCss: metadata.manifest.hasClientCss || false,
              hasClientScript: metadata.manifest.hasClientScript || false,
              version: metadata.manifest.version || '1.0.0',
            }
          : null,
    };
  }

  ws.sendToPublicChannel('extension:updated', payload);
}

/**
 * Temp roots the install and verify paths create under `os.tmpdir()`.
 *
 * Each holds one entry per operation, cleaned up by that operation's own
 * `finally`. A `finally` does not run for SIGKILL or an OOM kill, so every
 * such death strands its entry — a downloaded package or a whole extracted
 * tree — with nothing that ever revisits it.
 */
const INSTALL_TEMP_ROOTS = Object.freeze([
  'xnapify-hub-install',
  'xnapify-hub-verify',
  'xnapify-extension-install',
]);

/**
 * Backups written beside the extension they snapshot.
 *
 * `.rollback.` is the upgrade path's. The install path adds two more that this
 * pattern used to miss entirely: `.replaced-<pid>-<rand>`, the swap taken
 * before the new tree moves in, and `.failed-<pid>-<rand>`, the rejected
 * install moved aside when Extension.create fails. All three are full copies of
 * an extension tree, and all three are stranded by a kill that skips the
 * cleanup that would otherwise remove them.
 */
const INSTALL_BACKUP_PATTERN = /\.rollback\.|\.replaced-|\.failed-/;

/**
 * Remove install artifacts left behind by a process that was killed.
 *
 * Age is the only safe discriminator: a live install's scratch directory is
 * indistinguishable from an abandoned one, so the grace period has to sit
 * above the longest an install can legitimately take (a hub download plus an
 * extraction). Never throws — housekeeping must not fail the boot it runs in.
 *
 * @param {object} [options]
 * @param {string} [options.extensionsDir] - Where `.rollback` backups live
 * @param {number} [options.graceMs] - Minimum age before an entry is removed
 * @param {string} [options.tmpDir] - Override for the temp root parent
 * @returns {Promise<number>} How many entries were removed
 */
export async function sweepInstallTemps({
  extensionsDir = null,
  graceMs = 6 * 60 * 60_000,
  tmpDir = os.tmpdir(),
} = {}) {
  const cutoff = Date.now() - graceMs;
  let removed = 0;

  const reap = async (parent, matches) => {
    let entries;
    try {
      entries = await fs.promises.readdir(parent);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (matches && !matches(entry)) continue;
      const target = path.join(parent, entry);
      try {
        const stats = await fs.promises.stat(target);
        if (stats.mtimeMs > cutoff) continue;
        await fs.promises.rm(target, { recursive: true, force: true });
        removed += 1;
      } catch {
        // Swept by someone else, or not ours to remove. Either is fine.
      }
    }
  };

  for (const root of INSTALL_TEMP_ROOTS) {
    await reap(path.join(tmpDir, root), null);
  }
  if (extensionsDir) {
    const matches = name => INSTALL_BACKUP_PATTERN.test(name);
    await reap(extensionsDir, matches);

    // Scoped names put the backup one level down, so a flat listing of
    // extensionsDir only ever sees the scope directory itself — which matches
    // nothing. Every extension in this project is scoped
    // (@xnapify-extension/...), so without this the extensionsDir sweep
    // reclaimed nothing at all.
    let scopes = [];
    try {
      scopes = await fs.promises.readdir(extensionsDir, {
        withFileTypes: true,
      });
    } catch {
      scopes = [];
    }
    for (const entry of scopes) {
      // withFileTypes uses lstat, so a symlinked scope is not isDirectory()
      // and is skipped — the sweep must not follow a link out of the tree.
      if (!entry.isDirectory() || !entry.name.startsWith('@')) continue;
      await reap(path.join(extensionsDir, entry.name), matches);
    }
  }

  return removed;
}
