/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';

import { hashElement } from 'folder-hash';
import Hashids from 'hashids';

const DEFAULT_OPTIONS = Object.freeze({
  algo: 'sha256',
  encoding: 'hex',
  folders: Object.freeze({
    exclude: Object.freeze(['node_modules', '.git', '__tests__', '__mocks__']),
  }),
  files: Object.freeze({
    exclude: Object.freeze(['.DS_Store', 'package-lock.json', 'npm-debug.log']),
  }),
});

// ========================================================================
// Checksum
// ========================================================================

/**
 * Compute a SHA-256 checksum of an extension directory.
 *
 * @param {string} dir - Absolute path to the extension directory
 * @param {Object} [options] - Override/extend default hash options
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 * @throws {TypeError} If dir is not a non-empty string
 * @throws {Error} If hashing fails or returns no hash
 */
export async function computeChecksum(dir, options) {
  if (options == null) {
    options = {};
  }

  if (typeof dir !== 'string' || dir.trim() === '') {
    throw new TypeError('computeChecksum: dir must be a non-empty string');
  }

  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    folders: {
      ...DEFAULT_OPTIONS.folders,
      ...(options.folders || {}),
      exclude: [
        ...DEFAULT_OPTIONS.folders.exclude,
        ...(options.folders && options.folders.exclude
          ? options.folders.exclude
          : []),
      ],
    },
    files: {
      ...DEFAULT_OPTIONS.files,
      ...(options.files || {}),
      exclude: [
        ...DEFAULT_OPTIONS.files.exclude,
        ...(options.files && options.files.exclude
          ? options.files.exclude
          : []),
      ],
    },
  };

  let result;
  try {
    result = await hashElement(dir, opts);
  } catch (err) {
    throw new Error(
      'computeChecksum: failed to hash directory "' + dir + '": ' + err.message,
    );
  }

  if (!result || !result.hash) {
    throw new Error(
      'computeChecksum: no hash returned for directory "' + dir + '"',
    );
  }

  return result.hash;
}

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
