/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import os from 'os';
import path from 'path';

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
  parseInt(process.env.XNAPIFY_UPLOAD_FILE_SIZE, 10) ||
  DEFAULT_FILE_SIZES.LARGE;

export const MAX_FILE_LENGTH =
  parseInt(process.env.XNAPIFY_UPLOAD_FILE_LENGTH, 10) || 255;

const isProd = process.env.NODE_ENV === 'production';

export const UPLOAD_DIR =
  process.env.XNAPIFY_UPLOAD_DIR ||
  (isProd
    ? path.join(os.homedir(), '.xnapify', 'uploads')
    : path.join(process.cwd(), '.data', 'uploads'));

export const ALLOWED_EXTENSIONS = process.env.XNAPIFY_UPLOAD_FILE_EXT
  ? process.env.XNAPIFY_UPLOAD_FILE_EXT.split(',').map(ext => ext.trim())
  : null;

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
