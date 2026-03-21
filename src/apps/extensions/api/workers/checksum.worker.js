/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Checksum Worker - Stateless Piscina worker for extension checksum operations.
 * Runs in a separate thread to avoid blocking the main event loop
 * during CPU-intensive SHA-256 directory hashing.
 */

import { hashElement } from 'folder-hash';

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

function mergeOptions(overrides = {}) {
  return {
    ...DEFAULT_OPTIONS,
    ...overrides,
    folders: { ...DEFAULT_OPTIONS.folders, ...(overrides.folders || {}) },
    files: { ...DEFAULT_OPTIONS.files, ...(overrides.files || {}) },
  };
}

/**
 * Compute SHA-256 checksum of an extension directory.
 *
 * @param {{ dir: string, options?: Object }} data
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function COMPUTE_CHECKSUM(data) {
  const { dir, options } = data;
  const opts = mergeOptions(options);
  const result = await hashElement(dir, opts);
  return result.hash;
}

/**
 * Verify an extension directory against an expected checksum.
 *
 * @param {{ dir: string, expectedChecksum: string, options?: Object }} data
 * @returns {Promise<{ valid: boolean, actual: string }>}
 */
export async function VERIFY_CHECKSUM(data) {
  const { dir, expectedChecksum, options } = data;
  const actual = await COMPUTE_CHECKSUM({ dir, options });
  return { valid: actual === expectedChecksum, actual };
}
