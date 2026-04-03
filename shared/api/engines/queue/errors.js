/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Base Queue Error
 */
export class QueueError extends Error {
  constructor(message, code = 'QUEUE_ERROR', statusCode = 500) {
    super(message);
    this.name = 'QueueError';
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Job Not Found Error
 */
export class JobNotFoundError extends QueueError {
  constructor(jobId) {
    super(`Job not found: ${jobId}`, 'JOB_NOT_FOUND', 404);
    this.name = 'JobNotFoundError';
    this.jobId = jobId;
  }
}

/**
 * Job Processing Error
 */
export class JobProcessingError extends QueueError {
  constructor(jobId, message, originalError = null) {
    super(`Job processing failed: ${message}`, 'JOB_PROCESSING_ERROR', 500);
    this.name = 'JobProcessingError';
    this.jobId = jobId;
    this.originalError = originalError;
  }
}

/**
 * Queue Connection Error
 */
export class QueueConnectionError extends QueueError {
  constructor(message) {
    super(`Queue connection failed: ${message}`, 'QUEUE_CONNECTION_ERROR', 503);
    this.name = 'QueueConnectionError';
  }
}
