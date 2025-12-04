/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Filesystem Controllers - Main Export File
 *
 * This file exports all controllers and utility functions for filesystem operations.
 * Import from this file to maintain backward compatibility with the original controller.js
 */

// Import controllers for internal use
import { uploadFiles } from './upload.controller';
import { downloadFiles } from './download.controller';
import { previewFile } from './preview.controller';
import { getFileInfo } from './info.controller';
import { deleteFiles } from './delete.controller';
import { renameFiles } from './rename.controller';
import { copyFiles } from './copy.controller';
import { synchronizeFiles } from './sync.controller';

/**
 * Create action-based filesystem controllers
 * @returns {Object} Object containing all action-based controllers that accept options
 */
export function createController() {
  // Return object with ALL functional controllers - no class instantiation!
  // Each controller function accepts options as a parameter
  return {
    // Controller functions that accept options directly
    uploadFiles:
      (options = {}) =>
      (req, res) =>
        uploadFiles(req, res, options),
    downloadFiles:
      (options = {}) =>
      (req, res) =>
        downloadFiles(req, res, options),
    getFileInfo:
      (options = {}) =>
      (req, res) =>
        getFileInfo(req, res, options),
    previewFile:
      (options = {}) =>
      (req, res) =>
        previewFile(req, res, options),
    deleteFiles:
      (options = {}) =>
      (req, res) =>
        deleteFiles(req, res, options),
    renameFiles:
      (options = {}) =>
      (req, res) =>
        renameFiles(req, res, options),
    copyFiles:
      (options = {}) =>
      (req, res) =>
        copyFiles(req, res, options),
    synchronizeFiles:
      (options = {}) =>
      (req, res) =>
        synchronizeFiles(req, res, options),
  };
}

/**
 * Create filesystem routes for Express app with individual controller configurations
 * @param {Function} Router - Express Router constructor (optional, will import if not provided)
 * @param {Object} controllers - Individual controller configurations
 * @param {Object} controllers.upload - Upload controller options
 * @param {Object} controllers.download - Download controller options
 * @param {Object} controllers.info - Info controller options
 * @param {Object} controllers.preview - Preview controller options
 * @param {Object} controllers.delete - Delete controller options
 * @param {Object} controllers.rename - Rename controller options
 * @param {Object} controllers.copy - Copy controller options
 * @param {Object} controllers.sync - Sync controller options
 * @returns {Router} Express router with filesystem routes
 *
 * @example
 * // Basic usage with Express Router
 * const router = createRouter(Router);
 *
 * // With individual controller configurations
 * const router = createRouter(Router, {
 *     upload: {
 *       maxFiles: 10,
 *       maxFileSize: 50 * 1024 * 1024,
 *       allowedMimeTypes: ['image/*', 'application/pdf']
 *     },
 *     delete: {
 *       batchDeleteThreshold: 15
 *     },
 *     sync: {
 *       timeout: 60000,
 *       maxRetries: 5
 *     }
 * });
 */
export function createRouter(Router, options = {}) {
  // Create action-based controllers
  const controllers = createController();

  // Create router
  const router = Router();

  // Upload files (single or multiple)
  router.post('/upload', controllers.uploadFiles(options.upload));

  // Download files (single or multiple)
  router.get('/download', controllers.downloadFiles(options.download));

  // File information
  router.get('/info', controllers.getFileInfo(options.info));

  // File preview
  router.get('/preview', controllers.previewFile(options.preview));

  // Delete files (single or multiple)
  router.delete('/delete', controllers.deleteFiles(options.delete));

  // Rename files (single or multiple)
  router.patch('/rename', controllers.renameFiles(options.rename));

  // Copy files (single or multiple)
  router.post('/copy', controllers.copyFiles(options.copy));

  // Synchronize files (single or multiple)
  router.post('/sync', controllers.synchronizeFiles(options.sync));

  // Error handling middleware
  router.use((error, req, res) => {
    if (error.name === 'FilesystemError') {
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    if (error.name === 'MulterError') {
      const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  });

  return router;
}
