/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import Hashids from 'hashids';

import config from '../config.js';

// ========================================================================
// Checksum
// ========================================================================

/**
 * The publishing side and the installing side must agree bit-for-bit, so they
 * share one implementation instead of two that drift. `checksum.util.js` is
 * deliberately free of `@shared` aliases and extension-less imports so this
 * build task, which runs on plain Node ESM, can load it directly.
 *
 * @see src/apps/extensions/api/utils/checksum.util.js
 */
export {
  computeChecksum,
  hashManifest,
  stableStringify,
  verifyExtensionChecksum,
  MANIFEST_FILE,
  SELF_REFERENTIAL_MANIFEST_FIELDS,
} from '../../src/apps/extensions/api/utils/checksum.util.js';

export { auditExtensionCapabilities } from '../../src/apps/extensions/api/utils/capabilities.util.js';

// ========================================================================
// Extension ID Generation
// ========================================================================

/** Default hashids alphabet. */
const DEFAULT_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Minimum output length for generated extension IDs. */
const MIN_LENGTH = 5;

/**
 * Fixed salt: an extension's id must be a pure function of its package name
 * so it is identical on every machine, build, and deployment. Deriving the
 * alphabet from `XNAPIFY_KEY` (as earlier versions did) tied ids to a
 * secret — rotating the key orphaned every `extensions.key` row.
 */
const SALT = 'xnapify-extension';
const hashids = new Hashids(SALT, MIN_LENGTH, DEFAULT_ALPHABET);

/**
 * Generate a deterministic, short, URL-safe extension ID from a manifest name.
 *
 * Strategy: SHA-256 hash the name into a fixed 32-byte digest, then extract
 * two 32-bit unsigned integers from the first 8 bytes. Hashids encodes these
 * two numbers into a compact string (similar to YouTube IDs).
 *
 * This gives a 2^64 collision space (~18 quintillion) — more than sufficient
 * for extension identity while keeping IDs short and filesystem-friendly.
 *
 * The encoding is deterministic and environment-independent: the same
 * name always yields the same id.
 *
 * @param {string} name - Extension manifest name (e.g. '@xnapify-extension/profile')
 * @returns {string|null} Compact encoded extension ID or null if name is invalid
 */
export function generateExtensionId(name) {
  if (!name || typeof name !== 'string') return null;
  const hash = crypto.createHash('sha256').update(name).digest();
  return hashids.encode(hash.readUInt32BE(0), hash.readUInt32BE(4));
}

// ========================================================================
// Bundled Extensions
// ========================================================================

/**
 * Identify the extensions that ship with this host build.
 *
 * `shared/extension/utils/compat.js` grants the privileged capability tier
 * (`db`, `models`, `worker`, …) to these and to nothing else installed at
 * runtime: they are compiled by the host's own build and covered by its
 * review, while a hub package arrives with a `package.json` it wrote itself.
 * The list has to be baked in at build time because both kinds end up in the
 * same `build/extensions` directory, so the runtime cannot tell them apart.
 *
 * Both the package name and the derived id are returned, since a manifest is
 * matched on either — the same as `XNAPIFY_TRUSTED_EXTENSIONS`.
 *
 * A directory is listed on the strength of its manifest name alone. Whether
 * its bundle then compiles is `tools/tasks/extension.js`'s business; an
 * extension that fails to build never loads, so it never asks for a grant.
 *
 * @returns {string[]} Package names and ids, sorted for a stable build define
 */
export function listBundledExtensionIds() {
  const dir = path.resolve(
    config.APP_DIR,
    config.env('XNAPIFY_EXTENSION_LOCAL_PATH', 'extensions'),
  );
  if (!fs.existsSync(dir)) return [];

  const ids = new Set();
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    let manifest;
    try {
      manifest = JSON.parse(
        fs.readFileSync(path.join(dir, dirent.name, 'package.json'), 'utf8'),
      );
    } catch {
      continue;
    }
    if (!manifest.name || typeof manifest.name !== 'string') continue;
    ids.add(manifest.name);
    const id = generateExtensionId(manifest.name);
    if (id) ids.add(id);
  }

  return [...ids].sort();
}
