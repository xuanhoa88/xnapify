/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Filesystem Engine
 *
 * Streaming file operations with multiple provider support.
 * Worker processing auto-enabled for batch operations.
 *
 * @example
 * // Upload
 * await fs.upload({ fileName: 'photo.jpg', buffer, mimeType: 'image/jpeg' });
 *
 * // Download (returns stream)
 * const result = await fs.download('photo.jpg');
 * result.data.stream.pipe(res);
 *
 * // Other operations
 * await fs.remove('photo.jpg');
 * await fs.copy({ source: 'a.jpg', target: 'b.jpg' });
 * await fs.rename({ oldName: 'a.jpg', newName: 'b.jpg' });
 * await fs.info('photo.jpg');
 * await fs.preview('photo.jpg');
 *
 * // Worker control (default: auto-decides)
 * await fs.upload(files, { useWorker: true });
 *
 * // Middleware
 * const upload = fs.useUploadMiddleware({ fieldName: 'avatar', maxFiles: 1 });
 * router.post('/avatar', upload, (req, res) => {
 *   const result = req[fs.MIDDLEWARES.UPLOAD];
 * });
 *
 * // Isolated instance for testing
 * const testFs = createFactory({ provider: 'memory' });
 */

import { createFactory } from './factory';

export { createFactory };

const fs = createFactory();
export default fs;
