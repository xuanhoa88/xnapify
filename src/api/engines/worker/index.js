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
 */

// Error classes
export { WorkerError, createWorkerErrorClass } from './errors';

// Worker utilities
export { createWorker, setupForkMode } from './worker-utils';

// Worker service factory
export { createWorkerService, DEFAULT_WORKER_CONFIG } from './WorkerService';
