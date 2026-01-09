/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Filesystem Engine
 *
 * Provides filesystem operations with multiple provider support
 * (Local, Memory, SelfHost). Handles upload, download, delete, copy,
 * rename, info, preview, and sync operations.
 *
 * @example
 * // Access singleton instance
 * const manager = fs.default;
 *
 * // Upload file(s)
 * await fs.default.upload({ fileName: 'photo.jpg', buffer, mimeType: 'image/jpeg' });
 *
 * // Download file
 * const result = await fs.default.download('photo.jpg');
 *
 * // Delete file(s)
 * await fs.default.remove('photo.jpg');
 * await fs.default.remove(['file1.jpg', 'file2.jpg']); // bulk
 *
 * // Copy file
 * await fs.default.copy({ source: 'photo.jpg', target: 'photo-copy.jpg' });
 *
 * // Rename file
 * await fs.default.rename({ oldName: 'photo.jpg', newName: 'renamed.jpg' });
 *
 * // Get file info
 * const info = await fs.default.info('photo.jpg');
 *
 * // Preview file
 * const preview = await fs.default.preview('photo.jpg');
 *
 * @example
 * // Upload middleware usage
 * const avatarUpload = fs.default.useUploadMiddleware({
 *   fieldName: 'avatar',
 *   maxFiles: 1,
 *   maxFileSize: 10 * 1024 * 1024, // 10MB
 * });
 *
 * // In routes
 * router.post('/avatar', requireAuth, avatarUpload, controller.uploadAvatar);
 *
 * // Access upload result in controller
 * const uploadResult = req[fs.default.MIDDLEWARES.UPLOAD];
 *
 * @example
 * // Create isolated instance (for testing)
 * const testFs = fs.createFactory({ provider: 'memory' });
 * await testFs.upload({ fileName, buffer });
 *
 * @example
 * // Use services with worker support
 * await fs.services.upload(manager, files, { useWorker: true });
 *
 * @example
 * // Add custom provider (cannot override existing)
 * class S3Provider {
 *   async store(fileName, buffer, options) { ... }
 *   async retrieve(fileName) { ... }
 *   async delete(fileName) { ... }
 *   async exists(fileName) { ... }
 *   async getMetadata(fileName) { ... }
 *   async getStream(fileName) { ... }
 * }
 *
 * fs.default.addProvider('s3', new S3Provider());
 * await fs.default.upload({ fileName, buffer }, { provider: 's3' });
 */

import { createFactory } from './factory';

// Export factory for creating instances
export { createFactory };

// Export services for direct usage with worker support
export * as services from './services';

/**
 * Singleton instance of FilesystemManager
 * Used by the application via fs.default
 */
const fs = createFactory();

export default fs;
