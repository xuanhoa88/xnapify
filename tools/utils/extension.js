/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const crypto = require('crypto');

const { hashElement } = require('folder-hash');
// Sqids v0.3.0 uses Blob for multibyte validation. Node 16 ships Blob
// inside the `buffer` module rather than as a global, so polyfill it.
if (typeof globalThis.Blob === 'undefined')
  globalThis.Blob = require('buffer').Blob; // eslint-disable-line global-require
const Sqids = require('sqids').default;

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
async function computeChecksum(dir, options) {
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

/** Default sqids alphabet. */
const DEFAULT_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Minimum output length for generated extension IDs. */
const MIN_LENGTH = 8;

/**
 * Derive a deterministically shuffled alphabet from a secret key.
 * Uses HMAC-SHA256 as a seed for a Fisher-Yates shuffle so the same
 * key always produces the same alphabet permutation.
 *
 * @param {string} key - Secret key (XNAPIFY_KEY)
 * @returns {string} Shuffled alphabet
 */
function deriveAlphabet(key) {
  const seed = crypto.createHmac('sha256', key).update('sqids').digest();
  const chars = DEFAULT_ALPHABET.split('');
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = seed[i % seed.length] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

const alphabet = process.env.XNAPIFY_KEY
  ? deriveAlphabet(process.env.XNAPIFY_KEY)
  : undefined;

const sqids = new Sqids({
  minLength: MIN_LENGTH,
  ...(alphabet ? { alphabet } : {}),
});

/**
 * Generate a deterministic, URL-safe, obfuscated extension ID from a
 * manifest name. Uses sqids to encode the full character code sequence,
 * guaranteeing collision-free output.
 *
 * When `XNAPIFY_KEY` is set, the sqids alphabet is derived from the key
 * via HMAC-SHA256, making IDs unique per deployment. Without the key,
 * the default sqids alphabet is used.
 *
 * @param {string} name - Extension manifest name (e.g. '@xnapify-extension/profile')
 * @returns {string|null} Encoded extension ID or null if name is invalid
 */
function generateExtensionId(name) {
  if (!name || typeof name !== 'string') return null;
  const codes = [...name].map(c => c.charCodeAt(0));
  return sqids.encode(codes);
}

module.exports = { computeChecksum, generateExtensionId };
