/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Filesystem Constants and Configuration
 */

// Size conversion constants
export const SIZE_LIMITS = Object.freeze({
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  TB: 1024 * 1024 * 1024 * 1024,
});

// Default file size limits
export const DEFAULT_FILE_SIZES = Object.freeze({
  SMALL: 1 * SIZE_LIMITS.MB, // 1MB
  MEDIUM: 10 * SIZE_LIMITS.MB, // 10MB
  LARGE: 50 * SIZE_LIMITS.MB, // 50MB
  XLARGE: 100 * SIZE_LIMITS.MB, // 100MB
});

// Configuration from environment variables
export const MAX_FILE_SIZE =
  parseInt(process.env.RSK_FS_MAX_FILE_SIZE, 10) || DEFAULT_FILE_SIZES.LARGE;

export const MAX_FILENAME_LENGTH =
  parseInt(process.env.RSK_FS_MAX_FILENAME_LENGTH, 10) || 255;

export const UPLOAD_DIR = process.env.RSK_FS_UPLOAD_DIR || './uploads';

export const ALLOWED_EXTENSIONS = process.env.RSK_FS_ALLOWED_EXTENSIONS
  ? process.env.RSK_FS_ALLOWED_EXTENSIONS.split(',').map(ext => ext.trim())
  : null;

export const ENABLE_COMPRESSION =
  process.env.RSK_FS_ENABLE_COMPRESSION === 'true';

export const ORGANIZE_BY_DATE = process.env.RSK_FS_ORGANIZE_BY_DATE === 'true';

export const ORGANIZE_BY_CATEGORY =
  process.env.RSK_FS_ORGANIZE_BY_CATEGORY === 'true';

export const ORGANIZE_BY_USER = process.env.RSK_FS_ORGANIZE_BY_USER === 'true';

export const DEFAULT_PROVIDER = process.env.RSK_FS_DEFAULT_PROVIDER || 'local';

// Error codes
export const ERROR_CODES = Object.freeze({
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
  COPY_FAILED: 'COPY_FAILED',
  MOVE_FAILED: 'MOVE_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  STORAGE_FULL: 'STORAGE_FULL',
});

/**
 * Middleware Result Symbols
 *
 * Unique symbols for storing controller results on the request object.
 * Using Symbols avoids property name collisions with other middleware.
 *
 * @example
 * // Controller stores result:
 * req[MIDDLEWARE_RESULT.UPLOAD] = result;
 *
 * // Next middleware reads result:
 * const uploadResult = req[MIDDLEWARE_RESULT.UPLOAD];
 */
export const MIDDLEWARE_RESULT = Object.freeze({
  UPLOAD: Symbol('__rsk.fsUpload__'),
  DOWNLOAD: Symbol('__rsk.fsDownload__'),
  DELETE: Symbol('__rsk.fsDelete__'),
  COPY: Symbol('__rsk.fsCopy__'),
  RENAME: Symbol('__rsk.fsRename__'),
  SYNC: Symbol('__rsk.fsSync__'),
  INFO: Symbol('__rsk.fsInfo__'),
  PREVIEW: Symbol('__rsk.fsPreview__'),
});
