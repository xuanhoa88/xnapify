/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { hashElement } from 'folder-hash';

/**
 * Default options for folder hashing.
 * Excludes volatile / non-source files so the checksum
 * only changes when the actual plugin code changes.
 */
const DEFAULT_OPTIONS = {
  algo: 'sha256',
  encoding: 'hex',
  folders: {
    exclude: ['node_modules', '.git', '__tests__', '__mocks__'],
  },
  files: {
    exclude: [
      '.DS_Store',
      'package.json',
      'package-lock.json',
      'npm-debug.log',
    ],
  },
};

/**
 * Compute a SHA-256 checksum of a plugin directory.
 *
 * Uses the `folder-hash` package for recursive, deterministic hashing.
 * The returned hash changes if any tracked source file inside `dir` is
 * added, removed, renamed, or modified.
 *
 * @param {string} dir - Absolute path to the plugin directory
 * @param {Object} [options] - Override default hash options
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
export async function computeChecksum(dir, options = {}) {
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

/**
 * Verify a plugin directory against an expected checksum.
 *
 * @param {string} pluginDir - Absolute path to the plugin directory
 * @param {string} expectedChecksum - The trusted checksum from DB or manifest
 * @returns {Promise<{ valid: boolean, actual: string }>}
 */
export async function verifyPluginChecksum(pluginDir, expectedChecksum) {
  const actual = await computeChecksum(pluginDir);
  return {
    valid: actual === expectedChecksum,
    actual,
  };
}
