/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const { hashElement } = require('folder-hash');

/**
 * Default options for folder hashing.
 * Excludes volatile / non-source files so the checksum
 * only changes when the actual extension code changes.
 */
const DEFAULT_OPTIONS = {
  algo: 'sha256',
  encoding: 'hex',
  folders: {
    exclude: ['node_modules', '.git', '__tests__', '__mocks__'],
  },
  files: {
    exclude: ['.DS_Store', 'package-lock.json', 'npm-debug.log'],
  },
};

/**
 * Compute a SHA-256 checksum of an extension directory.
 *
 * Uses the `folder-hash` package for recursive, deterministic hashing.
 * The returned hash changes if any tracked source file inside `dir` is
 * added, removed, renamed, or modified.
 *
 * @param {string} dir - Absolute path to the extension directory
 * @param {Object} [options] - Override default hash options
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
async function computeChecksum(dir, options = {}) {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    folders: {
      ...DEFAULT_OPTIONS.folders,
      ...(options.folders || {}),
    },
    files: {
      ...DEFAULT_OPTIONS.files,
      ...(options.files || {}),
    },
  };

  const result = await hashElement(dir, opts);
  return result.hash;
}

module.exports = { computeChecksum, DEFAULT_OPTIONS };
