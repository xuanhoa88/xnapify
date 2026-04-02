/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const crypto = require('crypto');

const { hashElement } = require('folder-hash');

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

/**
 * Remaps a single hex character [0-9a-f] → [a-p]:
 *   '0'–'9'  →  'a'–'j'
 *   'a'–'f'  →  'k'–'p'
 *
 * @param {string} c - Single hex character
 * @returns {string} Remapped alpha character
 * @throws {RangeError} If c is not a valid hex character
 */
function remapHexChar(c) {
  const code = c.charCodeAt(0);
  if (c >= '0' && c <= '9') {
    return String.fromCharCode('a'.charCodeAt(0) + code - '0'.charCodeAt(0));
  }
  if (c >= 'a' && c <= 'f') {
    return String.fromCharCode('k'.charCodeAt(0) + code - 'a'.charCodeAt(0));
  }
  throw new RangeError('remapHexChar: unexpected hex character "' + c + '"');
}

/**
 * Derives a 32-character alphabetic key from a base64-encoded public key.
 * Maps SHA-256 hex output [0-9a-f] → [a-p] (digits→a-j, hex letters→k-p).
 *
 * @param {string} publicKey - Base64-encoded public key
 * @returns {string} 32-character string using only [a-p]
 * @throws {TypeError} If publicKey is not a non-empty string
 * @throws {Error} If publicKey decodes to an empty buffer
 */
function generateKey(publicKey) {
  if (typeof publicKey !== 'string' || publicKey.trim() === '') {
    throw new TypeError('generateKey: publicKey must be a non-empty string');
  }

  const keyBuffer = Buffer.from(publicKey, 'base64');
  if (keyBuffer.length === 0) {
    throw new Error(
      'generateKey: publicKey decoded to empty buffer — invalid base64',
    );
  }

  let hexHash;
  if (process.env.XNAPIFY_KEY) {
    hexHash = crypto
      .createHmac('sha256', process.env.XNAPIFY_KEY)
      .update(keyBuffer)
      .digest('hex');
  } else {
    hexHash = crypto.createHash('sha256').update(keyBuffer).digest('hex');
  }

  return hexHash.slice(0, 32).split('').map(remapHexChar).join('');
}

module.exports = { computeChecksum, generateKey };
