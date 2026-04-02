/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Custom error class for the Worker engine.
 *
 * @example
 * throw new WorkerError('Worker "math" not found', 'WORKER_NOT_FOUND', 404);
 */
export class WorkerError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {string} [code='WORKER_ERROR'] - Machine-readable error code
   * @param {number} [statusCode=500] - HTTP-compatible status code
   */
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'WorkerError';
    this.code = code || 'WORKER_ERROR';
    this.statusCode = statusCode || 500;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
