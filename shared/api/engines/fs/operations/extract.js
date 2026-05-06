/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Extract Operation
 *
 * Extracts files from a ZIP archive.
 *
 * @param {Object} manager - FilesystemManager instance
 * @param {Object} op - Operation parameters
 * @param {string|Buffer} op.zipSource - Path to ZIP file or buffer
 * @param {string} op.extractPath - Directory to extract files to
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extraction result
 */

import { extractZip } from '../utils/zipUtils.js';

export async function extract(
  manager,
  { zipSource, extractPath },
  options = {},
) {
  // Use shared utility for extraction
  return await extractZip(zipSource, extractPath, options);
}
