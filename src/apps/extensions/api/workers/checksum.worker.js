/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Checksum Worker - Stateless Piscina worker for extension checksum operations.
 * Runs in a separate thread to avoid blocking the main event loop
 * during CPU-intensive SHA-256 directory hashing.
 */

import { computeChecksum } from '../utils/checksum';

/**
 * Compute SHA-256 checksum of an extension directory.
 *
 * @param {{ dir: string, options?: Object }} data
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function COMPUTE_CHECKSUM(data) {
  return computeChecksum(data.dir, data.options);
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
