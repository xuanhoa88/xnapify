/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Upload Presets Configuration
 */

import path from 'path';

import { SIZE_LIMITS, config } from './constants';
import { getMimeTypesForCategories } from './fileTypes';

export const UPLOAD_PRESETS = Object.freeze({
  avatar: {
    get destination() {
      return (
        process.env.XNAPIFY_UPLOAD_AVATAR_DIR ||
        path.join(config.UPLOAD_DIR, 'avatars')
      );
    },
    get maxFileSize() {
      return (
        parseInt(process.env.XNAPIFY_UPLOAD_AVATAR_MAX, 10) ||
        2 * SIZE_LIMITS.MB
      );
    },
    allowedMimeTypes: getMimeTypesForCategories(['image']),
    maxFiles: 1,
    fieldName: 'avatar',
    generateSecureFileName: true,
    organizeByDate: false,
    organizeByCategory: false,
    organizeByUser: true,
    enableCompression: true,
    compressionQuality: 80,
  },

  document: {
    get destination() {
      return (
        process.env.XNAPIFY_UPLOAD_DOC_DIR ||
        path.join(config.UPLOAD_DIR, 'documents')
      );
    },
    get maxFileSize() {
      return (
        parseInt(process.env.XNAPIFY_UPLOAD_DOC_MAX, 10) || 10 * SIZE_LIMITS.MB
      );
    },
    allowedMimeTypes: getMimeTypesForCategories(['document']),
    maxFiles: 10,
    fieldName: 'documents',
    generateSecureFileName: true,
    organizeByDate: true,
    organizeByCategory: true,
    organizeByUser: true,
    enableCompression: false,
  },

  media: {
    get destination() {
      return (
        process.env.XNAPIFY_UPLOAD_MEDIA_DIR ||
        path.join(config.UPLOAD_DIR, 'media')
      );
    },
    get maxFileSize() {
      return (
        parseInt(process.env.XNAPIFY_UPLOAD_MEDIA_MAX, 10) ||
        50 * SIZE_LIMITS.MB
      );
    },
    allowedMimeTypes: getMimeTypesForCategories(['image', 'video', 'audio']),
    maxFiles: 20,
    fieldName: 'media',
    generateSecureFileName: true,
    organizeByDate: true,
    organizeByCategory: true,
    organizeByUser: false,
    enableCompression: true,
    compressionQuality: 85,
  },

  archive: {
    get destination() {
      return (
        process.env.XNAPIFY_UPLOAD_ARCHIVE_DIR ||
        path.join(config.UPLOAD_DIR, 'archives')
      );
    },
    get maxFileSize() {
      return (
        parseInt(process.env.XNAPIFY_UPLOAD_ARCHIVE_MAX, 10) ||
        100 * SIZE_LIMITS.MB
      );
    },
    allowedMimeTypes: getMimeTypesForCategories(['archive']),
    maxFiles: 5,
    fieldName: 'archives',
    generateSecureFileName: true,
    organizeByDate: true,
    organizeByCategory: false,
    organizeByUser: true,
    enableCompression: false,
  },

  general: {
    get destination() {
      return (
        process.env.XNAPIFY_UPLOAD_GENERAL_DIR ||
        path.join(config.UPLOAD_DIR, 'general')
      );
    },
    get maxFileSize() {
      return (
        parseInt(process.env.XNAPIFY_UPLOAD_GENERAL_MAX, 10) ||
        25 * SIZE_LIMITS.MB
      );
    },
    allowedMimeTypes: null, // Allow all types
    maxFiles: 15,
    fieldName: 'files',
    generateSecureFileName: true,
    organizeByDate: false,
    organizeByCategory: true,
    organizeByUser: false,
    enableCompression: false,
  },
});
