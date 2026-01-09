/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Worker Engine - Centralized Worker Pool Management
 *
 * Provides reusable worker infrastructure for background task processing.
 * Used by email, filesystem, and other engines that need worker pool management.
 *
 * @example
 * // Create a worker pool for an engine
 * const workersContext = require.context('./workers', false, /\.worker\.js$/);
 * const workerPool = worker.createWorkerPool(workersContext, {
 *   engineName: 'Email',
 *   maxWorkers: 4,
 * });
 *
 * // Send request to worker
 * const result = await workerPool.sendRequest('send', 'SEND_EMAIL', emailData);
 *
 * @example
 * // Creating a worker file (workers/send.worker.js)
 *
 * const processEmail = async (data) => { ... };
 *
 * // Same-process handler (default)
 * export default createWorkerHandler(processEmail, 'SEND_EMAIL');
 *
 * // Fork mode handler (fallback)
 * setupWorkerProcess(processEmail, 'SEND_EMAIL', 'Email');
 */

// Worker pool factory
export { createWorkerPool } from './createWorkerPool';

// Worker handler creator
export { createWorkerHandler } from './createWorkerHandler';

// Fork mode setup
export { setupWorkerProcess } from './setupWorkerProcess';

// Error class
export { WorkerError } from './errors';
