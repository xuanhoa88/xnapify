/**
 * Middleware Operations - Express middleware wrappers for fs operations
 */

import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Symbol for storing upload result in request
 */
export const MIDDLEWARES = {
  UPLOAD: Symbol('__rsk.fsUpload__'),
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
      const chunks = [];

      file.stream.on('data', chunk => chunks.push(chunk));
      file.stream.on('error', err => cb(err));
      file.stream.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const result = await provider.store(fileName, buffer, {
            mimeType: file.mimetype,
            originalName: file.originalname,
          });

          cb(null, {
            fileName: result.fileName || fileName,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: buffer.length,
            path: result.filePath || fileName,
            provider: result.provider || 'unknown',
          });
        } catch (error) {
          cb(error);
        }
      });
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

  return async function (req, res, next) {
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
}
