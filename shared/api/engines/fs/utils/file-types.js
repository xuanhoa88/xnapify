/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * File Types and MIME Type Management
 */

/**
 * Parse custom file types from environment variables
 * Format: "ext1:mime1,ext2:mime2" (e.g., ".heic:image/heic,.webp:image/webp")
 *
 * @param {string} envVar - Environment variable name
 * @returns {Object} Object with extension-to-MIME-type mappings
 */
function parseCustomFileTypes(envVar) {
  const envValue = process.env[envVar];
  if (!envValue) return {};

  const customTypes = {};
  const pairs = envValue.split(',');

  for (const pair of pairs) {
    const [ext, mimeType] = pair.split(':').map(s => s.trim());
    if (ext && mimeType) {
      const extension = ext.startsWith('.') ? ext : `.${ext}`;
      customTypes[extension.toLowerCase()] = mimeType;
    }
  }

  return customTypes;
}

/**
 * Create comprehensive file types structure
 * @returns {Object} File types with extensions, MIME types, and metadata
 */
function createFileTypes() {
  const customImageTypes = parseCustomFileTypes(
    'XNAPIFY_FS_CUSTOM_IMAGE_TYPES',
  );
  const customDocumentTypes = parseCustomFileTypes(
    'XNAPIFY_FS_CUSTOM_DOCUMENT_TYPES',
  );
  const customAudioTypes = parseCustomFileTypes(
    'XNAPIFY_FS_CUSTOM_AUDIO_TYPES',
  );
  const customVideoTypes = parseCustomFileTypes(
    'XNAPIFY_FS_CUSTOM_VIDEO_TYPES',
  );
  const customArchiveTypes = parseCustomFileTypes(
    'XNAPIFY_FS_CUSTOM_ARCHIVE_TYPES',
  );

  return {
    image: {
      extensions: [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.bmp',
        '.webp',
        '.svg',
        '.ico',
        '.tiff',
        '.tif',
      ],
      mimeTypes: {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff',
        ...customImageTypes,
      },
      category: 'image',
      description: 'Image files',
    },
    document: {
      extensions: [
        '.pdf',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.ppt',
        '.pptx',
        '.txt',
        '.rtf',
        '.odt',
        '.ods',
        '.odp',
      ],
      mimeTypes: {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain',
        '.rtf': 'application/rtf',
        '.odt': 'application/vnd.oasis.opendocument.text',
        '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
        '.odp': 'application/vnd.oasis.opendocument.presentation',
        ...customDocumentTypes,
      },
      category: 'document',
      description: 'Document files',
    },
    audio: {
      extensions: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
      mimeTypes: {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.aac': 'audio/aac',
        '.ogg': 'audio/ogg',
        '.wma': 'audio/x-ms-wma',
        '.m4a': 'audio/mp4',
        ...customAudioTypes,
      },
      category: 'audio',
      description: 'Audio files',
    },
    video: {
      extensions: [
        '.mp4',
        '.avi',
        '.mkv',
        '.mov',
        '.wmv',
        '.flv',
        '.webm',
        '.m4v',
      ],
      mimeTypes: {
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.webm': 'video/webm',
        '.m4v': 'video/x-m4v',
        ...customVideoTypes,
      },
      category: 'video',
      description: 'Video files',
    },
    archive: {
      extensions: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'],
      mimeTypes: {
        '.zip': 'application/zip',
        '.rar': 'application/vnd.rar',
        '.7z': 'application/x-7z-compressed',
        '.tar': 'application/x-tar',
        '.gz': 'application/gzip',
        '.bz2': 'application/x-bzip2',
        '.xz': 'application/x-xz',
        ...customArchiveTypes,
      },
      category: 'archive',
      description: 'Archive files',
    },
  };
}

// Export the file types structure
export const FILE_TYPES = createFileTypes();

/**
 * Get MIME types for specific categories
 * @param {Array} categories - Array of category names
 * @returns {Array} Array of MIME types
 */
export function getMimeTypesForCategories(categories) {
  const mimeTypes = [];
  for (const category of categories) {
    if (FILE_TYPES[category]) {
      mimeTypes.push(...Object.values(FILE_TYPES[category].mimeTypes));
    }
  }
  return mimeTypes;
}

/**
 * Get all file type categories
 * @returns {Array} Array of category names
 */
export function getFileTypeCategories() {
  return Object.keys(FILE_TYPES);
}

/**
 * Check if a file type category exists
 * @param {string} category - Category name
 * @returns {boolean} True if category exists
 */
export function hasFileTypeCategory(category) {
  return Object.prototype.hasOwnProperty.call(FILE_TYPES, category);
}

/**
 * Get supported extensions for a category
 * @param {string} category - File category
 * @returns {Array} Array of extensions
 */
export function getSupportedExtensions(category) {
  if (!FILE_TYPES[category]) return [];
  return FILE_TYPES[category].extensions;
}

/**
 * Get supported MIME types for a category
 * @param {string} category - File category
 * @returns {Array} Array of MIME types
 */
export function getSupportedMimeTypes(category) {
  if (!FILE_TYPES[category]) return [];
  return Object.values(FILE_TYPES[category].mimeTypes);
}

/**
 * Get all supported extensions
 * @returns {Array} Array of all extensions
 */
export function getAllSupportedExtensions() {
  const extensions = [];
  for (const category of Object.keys(FILE_TYPES)) {
    extensions.push(...FILE_TYPES[category].extensions);
  }
  return extensions;
}

/**
 * Get all supported MIME types
 * @returns {Array} Array of all MIME types
 */
export function getAllSupportedMimeTypes() {
  const mimeTypes = [];
  for (const category of Object.keys(FILE_TYPES)) {
    mimeTypes.push(...Object.values(FILE_TYPES[category].mimeTypes));
  }
  return mimeTypes;
}

/**
 * Check if extension is supported
 * @param {string} extension - File extension
 * @returns {boolean} True if supported
 */
export function isSupportedExtension(extension) {
  const normalizedExt = extension.toLowerCase();
  for (const category of Object.keys(FILE_TYPES)) {
    if (FILE_TYPES[category].extensions.includes(normalizedExt)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if MIME type is supported
 * @param {string} mimeType - MIME type
 * @returns {boolean} True if supported
 */
export function isSupportedMimeType(mimeType) {
  for (const category of Object.keys(FILE_TYPES)) {
    if (Object.values(FILE_TYPES[category].mimeTypes).includes(mimeType)) {
      return true;
    }
  }
  return false;
}

/**
 * Get MIME type for a file
 * @param {string} fileName - File name
 * @returns {string} MIME type
 */
export function getMimeType(fileName) {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));

  for (const category of Object.keys(FILE_TYPES)) {
    const mimeType = FILE_TYPES[category].mimeTypes[extension];
    if (mimeType) {
      return mimeType;
    }
  }

  return 'application/octet-stream'; // Default MIME type
}
