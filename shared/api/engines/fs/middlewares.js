/**
 * Middleware Operations - Express middleware wrappers for fs operations
 */

import path from 'path';

import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

/**
 * Symbol for storing upload result in request
 */
export const MIDDLEWARES = {
  UPLOAD: Symbol('__xnapify.fsUpload__'),
};

/**
 * Generate unique filename
 * @param {string} originalName - Original file name
 * @returns {string} Unique filename
 */
function generateFileName(originalName) {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const uniqueId = uuidv4().slice(0, 8);
  return `${timestamp}_${uniqueId}${ext}`;
}

/**
 * Create custom multer storage engine using filesystem provider
 * @param {Object} provider - Filesystem provider instance (local, memory, etc.)
 * @returns {Object} Multer storage engine
 */
function createProviderStorage(provider) {
  return {
    _handleFile(req, file, cb) {
      const fileName = generateFileName(file.originalname);

      // Pass stream directly to provider - each provider handles streaming internally
      // Local provider: streams directly to disk (zero buffering)
      // Memory/Selfhost providers: buffer internally (inherent limitation)
      provider
        .store(fileName, file.stream, {
          mimeType: file.mimetype,
          originalName: file.originalname,
        })
        .then(result => {
          cb(null, {
            fileName: result.fileName || fileName,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: result.size,
            path: result.filePath || fileName,
            provider: result.provider || 'unknown',
          });
        })
        .catch(err => cb(err));
    },

    _removeFile(req, file, cb) {
      provider
        .delete(file.fileName)
        .then(() => cb(null))
        .catch(err => cb(err));
    },
  };
}

/**
 * Create file filter for multer
 * @param {Array} allowedMimeTypes - Array of allowed MIME types
 * @returns {Function} Multer file filter
 */
function createFileFilter(allowedMimeTypes) {
  if (!allowedMimeTypes || allowedMimeTypes.length === 0) {
    return (req, file, cb) => cb(null, true);
  }

  return (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  };
}

/**
 * Create upload middleware using filesystem provider
 * @param {Object} provider - Filesystem provider instance
 * @param {Object} options - Upload options
 * @returns {Function} Express middleware
 */
export function createUploadMiddleware(provider, options = {}) {
  const {
    fieldName = 'file',
    maxFiles = 1,
    maxFileSize = 10 * 1024 * 1024, // 10MB default
    allowedMimeTypes = null,
    useWorker = false, // Enable worker processing for background operations
  } = options;

  const storage = createProviderStorage(provider);
  const fileFilter = createFileFilter(allowedMimeTypes);

  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles,
    },
  });

  // Determine upload type based on maxFiles
  const uploadHandler =
    maxFiles === 1
      ? upload.single(fieldName)
      : upload.array(fieldName, maxFiles);

  // Base middleware function
  const middleware = async function (req, res, next) {
    try {
      // Run multer
      await new Promise((resolve, reject) => {
        uploadHandler(req, res, err => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Get uploaded files
      const files = req.file ? [req.file] : req.files || [];

      if (files.length === 0) {
        req[MIDDLEWARES.UPLOAD] = {
          success: false,
          error: 'No file uploaded',
        };
        return next();
      }

      // Format result
      const uploadedFiles = files.map(file => ({
        fileName: file.fileName,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        path: file.path,
        provider: file.provider,
      }));

      req[MIDDLEWARES.UPLOAD] = {
        success: true,
        data: maxFiles === 1 ? uploadedFiles[0] : { successful: uploadedFiles },
      };

      next();
    } catch (error) {
      req[MIDDLEWARES.UPLOAD] = {
        success: false,
        error: error.message,
      };
      next();
    }
  };

  // If useWorker is enabled, wrap with worker processing
  if (useWorker) {
    return async function workerMiddleware(req, res, next) {
      // Run base middleware first (stores file to disk)
      await new Promise(resolve => {
        middleware(req, res, resolve);
      });

      // If upload succeeded, optionally process via worker
      const uploadResult = req[MIDDLEWARES.UPLOAD];
      if (uploadResult && uploadResult.success) {
        try {
          // Add worker processing flag to result
          uploadResult.workerProcessed = true;
          // Worker pool can be used for additional processing here
          // e.g., image resizing, thumbnail generation, etc.
        } catch (workerError) {
          console.warn('Worker processing failed:', workerError.message);
          // File is still uploaded, just worker processing failed
          uploadResult.workerError = workerError.message;
        }
      }

      next();
    };
  }

  return middleware;
}
