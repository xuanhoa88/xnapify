/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

import { JOB_STATUS } from './constants';

/**
 * Create a standardized job object.
 * Shared between MemoryQueue and FileQueue adapters.
 *
 * @param {string} name - Job name/type
 * @param {Object} data - Job payload
 * @param {string} queueName - Queue name
 * @param {Object} jobOptions - Merged job options
 * @returns {Object} Job object
 */
export function createJob(name, data, queueName, jobOptions) {
  return {
    id: uuidv4(),
    name,
    data,
    queue: queueName,
    status: jobOptions.delay > 0 ? JOB_STATUS.DELAYED : JOB_STATUS.PENDING,
    priority: jobOptions.priority,
    attempts: 0,
    maxAttempts: jobOptions.attempts,
    backoff: jobOptions.backoff,
    delay: jobOptions.delay,
    removeOnComplete: jobOptions.removeOnComplete,
    removeOnFail: jobOptions.removeOnFail,
    progress: 0,
    result: null,
    error: null,
    createdAt: Date.now(),
    processedAt: null,
    completedAt: null,
    failedAt: null,
    scheduledFor: jobOptions.delay > 0 ? Date.now() + jobOptions.delay : null,
  };
}
