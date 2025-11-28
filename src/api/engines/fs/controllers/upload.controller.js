/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Upload Controller
 *
 * Handles file upload operations with support for single and batch uploads.
 */

import multer from 'multer';
import * as filesystemActions from '../actions';
import workerService from '../workers';
import { MAX_FILE_SIZE } from '../utils/constants';

/**
 * Hybrid decision logic for upload operations
 * @param {Array} filesData - Array of file data
 * @param {Object} options - Decision options
 * @returns {Object} Decision result
 */
function makeUploadDecision(filesData, options = {}) {
  const thresholds = {
    largeFileSize: options.largeFileSize || 10 * 1024 * 1024, // 10MB
    batchUploadThreshold: options.batchUploadThreshold || 3,
  };

  if (!Array.isArray(filesData)) {
    return {
      shouldUseWorker: false,
      reason: 'Invalid files data',
      operation: 'upload',
      timestamp: new Date().toISOString(),
    };
  }

  let shouldUseWorker = false;
  let reason = 'Small files, main process sufficient';

  // Use worker if multiple files
  if (filesData.length >= thresholds.batchUploadThreshold) {
    shouldUseWorker = true;
    reason = `Large batch (${filesData.length} files)`;
  }
  // Use worker if any file is large
  else if (filesData.some(file => file.size >= thresholds.largeFileSize)) {
    shouldUseWorker = true;
    reason = `Large files detected`;
  }

  return {
    shouldUseWorker,
    reason,
    operation: 'upload',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create multer configuration for file uploads
 * @param {Object} options - Configuration options
 * @returns {Object} Multer configuration object
 */
function createMulterConfig(options = {}) {
  const {
    maxFiles = 10,
    maxFileSize = MAX_FILE_SIZE,
    allowedMimeTypes = null, // null = allow all
  } = options || {};

  return {
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSize,
      files: maxFiles,
    },
    fileFilter: (req, file, cb) => {
      // Check MIME type if allowedMimeTypes is specified
      if (allowedMimeTypes && Array.isArray(allowedMimeTypes)) {
        if (!allowedMimeTypes.includes(file.mimetype)) {
          const error = new Error(
            `File type ${file.mimetype} not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
          );
          error.code = 'INVALID_FILE_TYPE';
          return cb(error, false);
        }
      }
      cb(null, true);
    },
  };
}

/**
 * Handle file upload (always batch processing)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Upload options
 */
export async function uploadFiles(req, res, options = {}) {
  const config = {
    maxFiles: 10,
    maxFileSize: 50 * 1024 * 1024, // 50MB default
    allowedMimeTypes: null, // null = allow all
    fileFieldName: 'files', // Default field name for file uploads
    ...options,
  };

  // Create multer configuration
  const multerConfig = createMulterConfig(config);

  try {
    // Get field name from query params, body, or use default
    const fileFieldName =
      req.query.fileFieldName || req.body.fileFieldName || config.fileFieldName;

    // Use pre-configured multer with dynamic field name
    const upload = multer(multerConfig).array(fileFieldName, config.maxFiles);

    // Promisify multer upload
    await new Promise((resolve, reject) => {
      upload(req, res, err => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
      });
    }

    // Convert multer files to our format
    const filesData = req.files.map(file => ({
      originalName: file.originalname,
      fileName: file.originalname, // Will be renamed by the action
      size: file.size,
      mimeType: file.mimetype,
      buffer: file.buffer,
    }));

    // Use hybrid decision service to determine processing method
    const decision = makeUploadDecision(req.files, options);

    let result;
    if (decision.shouldUseWorker) {
      // Use worker service for large/multiple files
      result = await workerService.processUpload(filesData);
    } else {
      // Use main process for small files
      result = await filesystemActions.uploadFiles(filesData);
    }

    res.json(result);
  } catch (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxSizeMB = Math.round(config.maxFileSize / (1024 * 1024));
        return res.status(400).json({
          success: false,
          error: `File too large. Maximum size is ${maxSizeMB}MB`,
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          error: `Too many files. Maximum is ${config.maxFiles} files`,
        });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
    }

    console.error('Upload error:', err);
    return res.status(500).json({
      success: false,
      error: 'Upload failed',
      details: err.message,
    });
  }
}
