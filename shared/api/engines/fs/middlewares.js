/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

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
  UPLOAD: Symbol('__xnapify.fs.upload__'),
};

// No real extension needs more than this — the longest common ones
// (.tar.gz, .min.js.map) sit well under it — while `path.extname` on an
// attacker-supplied filename is uncapped and multipart headers can carry one
// thousands of characters long. Left uncapped, the extension alone can push
// the generated name past NAME_MAX (255 on every target platform), and the
// provider's own temp suffix makes the write path longer still, turning an
// upload that should fail with a clean validation error into an ENAMETOOLONG
// from the filesystem instead.
const MAX_EXTENSION_LENGTH = 16;

/**
 * Generate unique filename
 * @param {string} originalName - Original file name
 * @returns {string} Unique filename
 */
function generateFileName(originalName) {
  const ext = path.extname(originalName).slice(0, MAX_EXTENSION_LENGTH);
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
  // Stores that have not settled yet, keyed by multer's own file object.
  //
  // multer aborts an upload by calling `_removeFile` on files whose
  // `_handleFile` has not called back yet, so a removal can arrive while the
  // provider is still writing. Deleting a name the writer has not created yet
  // removes nothing and the bytes land afterwards, so the removal waits here
  // for the store to settle. Weak keys so an upload that is never removed does
  // not pin its entry.
  const pendingStores = new WeakMap();

  /**
   * Delete a stored file, tolerating it already being gone.
   *
   * Every failed upload has two cleanup paths racing - this engine's own and
   * multer's abort sweep - so whichever loses finds nothing left to delete,
   * which is the work already done rather than a failure. Each provider wraps
   * not-found in its own error, so ask the provider whether the file is still
   * there instead of matching on a message.
   */
  const removeStoredFile = async fileName => {
    try {
      await provider.delete(fileName);
    } catch (error) {
      const stillStored = await provider.exists(fileName).catch(() => true);
      if (stillStored) throw error;
    }
  };

  return {
    _handleFile(req, file, cb) {
      const fileName = generateFileName(file.originalname);

      // Publish the name before the write starts. multer's abort sweep only
      // considers in-flight files carrying a `path`, and it drops this file
      // from that list before `cb` runs, so a name known only inside this
      // closure until the store settles is a name no cleanup can ever reach -
      // an aborted upload keeps its bytes forever. The sweep only tests `path`
      // for truthiness; providers address files by name, and the memory and
      // selfhost ones have no filesystem path at all.
      file.fileName = fileName;
      file.path = fileName;

      // Pass stream directly to provider - each provider handles streaming internally
      // Local provider: streams directly to disk (zero buffering)
      // Memory/Selfhost providers: buffer internally (inherent limitation)
      const store = provider.store(fileName, file.stream, {
        mimeType: file.mimetype,
        originalName: file.originalname,
      });

      pendingStores.set(
        file,
        store.then(
          () => {},
          () => {},
        ),
      );

      store
        .then(result => {
          pendingStores.delete(file);
          cb(null, {
            fileName: result.fileName || fileName,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: result.size,
            path: result.filePath || fileName,
            provider: result.provider || 'unknown',
          });
        })
        .catch(err => {
          pendingStores.delete(file);
          // A rejected store can still have written part of the file - the
          // local provider streams straight to its destination - and multer
          // has already dropped this file from its abort sweep, so those bytes
          // have no other owner.
          return removeStoredFile(fileName)
            .catch(cleanupError => {
              console.warn(
                `[fs:upload] Failed to remove partial upload ${fileName}: ${cleanupError.message}`,
              );
            })
            .then(() => cb(err));
        });
    },

    _removeFile(req, file, cb) {
      // multer merges the `_handleFile` result into the file object only for
      // uploads that completed; an aborted one arrives carrying just the name
      // published above. Without a name there is nothing to delete, and
      // passing it on only makes the provider report a bogus path error.
      if (!file.fileName) {
        cb(null);
        return;
      }

      const pending = pendingStores.get(file) || Promise.resolve();
      pending
        .then(() => removeStoredFile(file.fileName))
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
    // `maxSize` accepted as an alias: a caller reaching for the option that
    // reads naturally (every route here originally shipped with `maxSize`)
    // was silently building a middleware with the 10MB default instead —
    // multer takes whichever key this destructure names, so a typo-shaped
    // mismatch like this fails by ignoring the value, not by erroring on it.
    maxFileSize = options.maxSize ?? 10 * 1024 * 1024, // 10MB default
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
          // Worker functions can be used for additional processing here
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
