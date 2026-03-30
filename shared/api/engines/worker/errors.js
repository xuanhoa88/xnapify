/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Worker Engine Error Class
 *
 * Base error class for worker-related errors that can be extended
 * by specific engine implementations.
 */
export class WorkerError extends Error {
  constructor(message, code = 'WORKER_ERROR', statusCode = 500) {
    super(message);
    this.name = 'WorkerError';
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkerError);
    }
  }
}
