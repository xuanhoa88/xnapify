/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Worker Engine - Centralized Worker Management
 *
 * Provides reusable worker infrastructure for background task processing.
 * Used by email, filesystem, and other engines that need worker pool management.
 *
 * @example <caption>Creating a Worker Service</caption>
 * const workersContext = require.context('./workers', false, /\.worker\.js$/);
 * const workerService = createWorkerService(workersContext, {
 *   engineName: 'Email',
 *   maxWorkers: 4,
 * });
 *
 * @example <caption>Sending a Request</caption>
 * const result = await workerService.sendRequest('send', 'SEND_EMAIL', emailData);
 *
 * @example <caption>Creating a Worker File</caption>
 * // In workers/send.worker.js
 * const processEmail = async (data) => { ... };
 * export default createWorker(processEmail, 'SEND_EMAIL');
 * setupForkMode(processEmail, 'SEND_EMAIL', 'Email');
 */

// Worker utilities
export { createWorker, setupForkMode } from './utils';

// Worker service factory
export { createWorkerService } from './factory';

// Error class
export { WorkerError } from './errors';
