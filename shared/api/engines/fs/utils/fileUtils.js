/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * File Utility Functions
 */

import crypto from 'crypto';
import path from 'path';

import { SIZE_LIMITS, DEFAULT_CONFIG } from './constants';
import { FILE_TYPES } from './fileTypes';
import { UPLOAD_PRESETS } from './uploadPresets';

/**
 * Sanitize filename to remove dangerous characters
 *
 * @param {string} fileName - Filename to sanitize
 * @returns {string} Sanitized filename
 */
function sanitizeFileName(fileName) {
  return (
    fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace dangerous chars
      .replace(/_{2,}/g, '_') // Replace multiple underscores
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .substring(0, DEFAULT_CONFIG.MAX_FILE_LENGTH) || 'file'
  ); // Fallback name
}

/**
 * Generate secure filename with timestamp and hash
 *
 * @param {string} originalName - Original filename
 * @param {Object} options - Options
 * @returns {string} Secure filename
 */
export function generateSecureFileName(originalName, options = {}) {
  const {
    includeTimestamp = true,
    includeHash = true,
    preserveExtension = true,
    prefix = '',
    suffix = '',
  } = options;

  const sanitized = sanitizeFileName(originalName);
  const extension = preserveExtension ? path.extname(sanitized) : '';
  const baseName = path.basename(sanitized, extension);

  let fileName = baseName;

  if (prefix) {
    fileName = `${prefix}_${fileName}`;
  }

  if (includeTimestamp) {
    fileName = `${Date.now()}_${fileName}`;
  }

  if (includeHash) {
    const hash = crypto.randomBytes(8).toString('hex');
    fileName = `${fileName}_${hash}`;
  }

  if (suffix) {
    fileName = `${fileName}_${suffix}`;
  }

  return fileName + extension;
}

/**
 * Get file extension from filename
 *
 * @param {string} fileName - Filename
 * @returns {string} File extension (with dot)
 */
export function getFileExtension(fileName) {
  return path.extname(fileName).toLowerCase();
}

/**
 * Check if file extension is allowed
 *
 * @param {string} fileName - Filename to check
 * @returns {boolean} True if allowed
 */
export function isAllowedExtension(fileName) {
  if (!DEFAULT_CONFIG.ALLOWED_EXTENSIONS) return true; // Allow all if not configured

  const extension = getFileExtension(fileName);
  return DEFAULT_CONFIG.ALLOWED_EXTENSIONS.includes(extension);
}

/**
 * Validate file size
 *
 * @param {number} fileSize - File size in bytes
 * @param {string} preset - Preset name (optional)
 * @returns {boolean} True if valid
 */
export function isValidFileSize(fileSize, preset = null) {
  if (preset && UPLOAD_PRESETS[preset]) {
    return fileSize <= UPLOAD_PRESETS[preset].maxFileSize;
  }
  return fileSize <= DEFAULT_CONFIG.MAX_FILE_SIZE;
}

/**
 * Format file size in human readable format
 *
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(SIZE_LIMITS.KB));

  return `${parseFloat((bytes / Math.pow(SIZE_LIMITS.KB, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Parse file size string to bytes
 *
 * @param {string} sizeString - Size string (e.g., '10MB', '5GB')
 * @returns {number} Size in bytes
 */
export function parseFileSize(sizeString) {
  const match = sizeString.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return 0;

  const [, size, unit] = match;
  const unitKey = unit.toUpperCase();

  if (SIZE_LIMITS[unitKey]) {
    return parseFloat(size) * SIZE_LIMITS[unitKey];
  }

  return parseFloat(size); // Assume bytes if unit not recognized
}

/**
 * Generate file hash
 *
 * @param {Buffer} buffer - File buffer
 * @param {string} algorithm - Hash algorithm
 * @returns {string} File hash
 */
export function generateFileHash(buffer, algorithm = 'sha256') {
  return crypto.createHash(algorithm).update(buffer).digest('hex');
}

/**
 * Check if file is an image
 *
 * @param {string} fileName - Filename
 * @returns {boolean} True if image
 */
export function isImageFile(fileName) {
  const extension = getFileExtension(fileName);
  return FILE_TYPES.image.extensions.includes(extension);
}

/**
 * Check if file is a document
 *
 * @param {string} fileName - Filename
 * @returns {boolean} True if document
 */
export function isDocumentFile(fileName) {
  const extension = getFileExtension(fileName);
  return FILE_TYPES.document.extensions.includes(extension);
}

/**
 * Check if file is an archive
 *
 * @param {string} fileName - Filename
 * @returns {boolean} True if archive
 */
export function isArchiveFile(fileName) {
  const extension = getFileExtension(fileName);
  return FILE_TYPES.archive.extensions.includes(extension);
}

/**
 * Check if file is audio
 *
 * @param {string} fileName - Filename
 * @returns {boolean} True if audio
 */
export function isAudioFile(fileName) {
  const extension = getFileExtension(fileName);
  return FILE_TYPES.audio.extensions.includes(extension);
}

/**
 * Check if file is video
 *
 * @param {string} fileName - Filename
 * @returns {boolean} True if video
 */
export function isVideoFile(fileName) {
  const extension = getFileExtension(fileName);
  return FILE_TYPES.video.extensions.includes(extension);
}

/**
 * Get file category based on extension
 *
 * @param {string} fileName - Filename
 * @returns {string} File category
 */
export function getFileCategory(fileName) {
  const extension = getFileExtension(fileName);

  for (const [category, info] of Object.entries(FILE_TYPES)) {
    if (info.extensions.includes(extension)) {
      return category;
    }
  }

  return 'other';
}

/**
 * Create directory path based on organization settings
 *
 * @param {string} fileName - Filename
 * @param {Object} options - Organization options
 * @returns {string} Directory path
 */
export function createDirectoryPath(fileName, options = {}) {
  const {
    organizeByDate = false,
    organizeByCategory = false,
    organizeByUser = false,
    userId = null,
    baseDir = '',
  } = options;

  let dirPath = baseDir;

  if (organizeByUser && userId) {
    dirPath = path.join(dirPath, `user_${userId}`);
  }

  if (organizeByCategory) {
    const category = getFileCategory(fileName);
    dirPath = path.join(dirPath, category);
  }

  if (organizeByDate) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    dirPath = path.join(dirPath, `${year}`, `${month}`, `${day}`);
  }

  return dirPath;
}
