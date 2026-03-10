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
 * ## Features
 *
 * - **Multiple Providers**: Local, Memory, Self-host with easy registration
 * - **Streaming Operations**: Efficient upload/download for large files
 * - **Comprehensive Operations**: Upload, download, copy, rename, remove, info, preview, sync
 * - **Express Middleware**: Multer-based upload middleware
 * - **Worker Integration**: Auto-offload for batch operations
 * - **Graceful Shutdown**: Automatic cleanup on process termination
 *
 * ---
 *
 * @example <caption>Upload File</caption>
 * await fs.upload({ fileName: 'photo.jpg', buffer, mimeType: 'image/jpeg' });
 *
 * @example <caption>Download File (returns stream)</caption>
 * const result = await fs.download('photo.jpg');
 * result.data.stream.pipe(res);
 *
 * @example <caption>Other Operations</caption>
 * await fs.remove('photo.jpg');
 * await fs.copy({ source: 'a.jpg', target: 'b.jpg' });
 * await fs.rename({ oldName: 'a.jpg', newName: 'b.jpg' });
 * await fs.info('photo.jpg');
 * await fs.preview('photo.jpg');
 *
 * @example <caption>Worker Control</caption>
 * // Worker control (default: auto-decides)
 * await fs.upload(files, { useWorker: true });
 *
 * @example <caption>Express Middleware</caption>
 * const upload = fs.useUploadMiddleware({ fieldName: 'avatar', maxFiles: 1 });
 * router.post('/avatar', upload, (req, res) => {
 *   const result = req[fs.MIDDLEWARES.UPLOAD];
 * });
 *
 * @example <caption>Isolated Instance</caption>
 * // Isolated instance for testing
 * const testFs = createFactory({ provider: 'memory' });
 *
 * @example <caption>Lifecycle Management</caption>
 * // Get all registered providers
 * const providers = fs.getProviderNames();
 * // ['local', 'memory', 'selfhost']
 *
 * // Check if provider exists
 * if (fs.hasProvider('local')) {
 *   console.log('Local provider available');
 * }
 *
 * // Get provider instance
 * const localProvider = fs.getProvider('local');
 *
 * // Get stats from all providers
 * const stats = fs.getAllStats();
 * // {
 * //   local: { files: 100, size: 1024000 },
 * //   memory: { available: false },
 * //   ...
 * // }
 *
 * // Cleanup (automatically called on process termination)
 * await fs.cleanup();
 *
 * @example <caption>Integration with Schedule Engine</caption>
 *
 * // Clean up old files daily
 * schedule.register('cleanup-old-files', '0 2 * * *', async () => {
 *   const files = await fs.list('uploads');
 *   const oldFiles = files.filter(f => isOlderThan(f, 30)); // 30 days
 *
 *   for (const file of oldFiles) {
 *     await fs.remove(file.name);
 *   }
 * });
 *
 * @example <caption>Integration with Queue Engine</caption>
 *
 * // Create a file processing channel
 * const fileProcessing = queue('file-processing', { concurrency: 3 });
 *
 * fileProcessing.on('resize-image', async (job) => {
 *   const result = await fs.download(job.data.fileName);
 *   const resized = await resizeImage(result.data.stream);
 *   await fs.upload({ fileName: job.data.outputName, buffer: resized });
 * });
 *
 * // Queue image for processing
 * queue.channel('file-processing').emit('resize-image', {
 *   fileName: 'original.jpg',
 *   outputName: 'thumbnail.jpg'
 * });
 */

import { createFactory } from './factory';

export { createFactory };

const fs = createFactory();
export default fs;
