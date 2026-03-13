/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Error Handling and Response Utilities
 */

import { WorkerError } from '../../worker';

import { ERROR_CODES } from './constants';

/**
 * Custom filesystem error class
 */
export class FilesystemError extends Error {
  constructor(message, code = ERROR_CODES.PROVIDER_ERROR, statusCode = 500) {
    super(message);
    this.name = 'FilesystemError';
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FilesystemError);
    }
  }
}

/**
 * Custom filesystem worker error class
 */
export class FilesystemWorkerError extends WorkerError {
  constructor(message, code = ERROR_CODES.WORKER_ERROR, statusCode = 500) {
    super(message, code, statusCode);
    this.name = 'FilesystemWorkerError';
  }
}

/**
 * Create standardized operation result object
 *
 * @param {boolean} success - Success status
 * @param {*} data - Response data
 * @param {string} message - Response message
 * @param {Error} error - Error object (optional)
 * @returns {Object} Standardized operation result
 */
export function createOperationResult(
  success,
  data = null,
  message = '',
  error = null,
) {
  const response = {
    success,
    data,
    message,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    response.error = {
      message: error.message,
      code: error.code || ERROR_CODES.PROVIDER_ERROR,
      statusCode: error.statusCode || 500,
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
      response.error.stack = error.stack;
    }
  }

  return response;
}
