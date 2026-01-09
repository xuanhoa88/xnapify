/**
 * Preview Service - Worker-enabled wrapper for preview operation
 */

import { preview as previewOperation } from '../operations/preview';
import workerService from '../workers';

/**
 * Preview file with optional worker processing
 * @param {Object} manager - FilesystemManager instance
 * @param {string} fileName - File name
 * @param {Object} options - Preview options
 * @param {boolean} options.useWorker - Force worker usage (true/false)
 * @returns {Promise<Object>} Preview result
 */
export async function preview(manager, fileName, options = {}) {
  // Preview is typically a quick operation, only use worker if explicitly requested
  if (options.useWorker === true) {
    return await workerService.processPreview(fileName, options);
  }

  return await previewOperation(manager, fileName, options);
}
