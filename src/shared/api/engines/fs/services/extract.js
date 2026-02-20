/**
 * Extract Service - Worker-enabled wrapper for extract operation
 */

import { extract as extractOperation } from '../operations/extract';
import workerPool from '../workers';

/**
 * Extract ZIP archive with optional worker processing
 *
 * @param {Object} manager - FilesystemManager instance
 * @param {string|Buffer} zipSource - Path to ZIP file or buffer
 * @param {string} extractPath - Directory to extract files to
 * @param {Object} options - Extraction options
 * @param {boolean} [options.useWorker] - Worker control:
 *   - `true`: Force worker processing
 *   - `false`: Force direct processing (bypass worker)
 *   - `undefined`: Auto-decide
 * @returns {Promise<Object>} Extraction result
 */
export async function extract(manager, zipSource, extractPath, options = {}) {
  // Use worker if forced or if options suggest heavy processing
  // Extraction is often CPU intensive, so defaulting to worker makes sense for larger files
  // However, for buffers, passing large data to worker might be slow
  const { useWorker } = options;

  if (useWorker === true) {
    return await workerPool.extractZip(zipSource, extractPath, options);
  }

  // If useWorker is false or undefined (and we don't have auto-detection logic yet), use direct operation
  // Note: Implementing auto-detection based on file size would require stat-ing the file first
  return await extractOperation(manager, { zipSource, extractPath }, options);
}
