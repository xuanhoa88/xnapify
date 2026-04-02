/**
 * Preview Service - Worker-enabled wrapper for preview operation
 */

import { preview as previewOperation } from '../operations/preview';
import { processPreview } from '../workers';

/**
 * Preview file with optional worker processing
 *
 * @param {Object} manager - FilesystemManager instance
 * @param {string} fileName - File name
 * @param {Object} options - Preview options
 * @param {boolean} [options.useWorker] - Worker control:
 *   - `true`: Force worker processing
 *   - `false`: Force direct processing (default)
 *   - `undefined`: Direct processing (preview is quick, no auto-worker)
 * @returns {Promise<Object>} Preview result
 *
 * @example
 * // Direct processing (default)
 * await fs.preview(manager, 'image.jpg');
 *
 * @example
 * // Force worker processing
 * await fs.preview(manager, 'image.jpg', { useWorker: true });
 */
export async function preview(manager, fileName, options = {}) {
  // Preview is typically a quick operation, only use worker if explicitly requested
  if (options.useWorker === true) {
    return await processPreview(fileName, options);
  }

  return await previewOperation(manager, fileName, options);
}
