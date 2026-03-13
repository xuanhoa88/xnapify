/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { HTTP_STATUS } from '../constants';

import {
  HttpError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ResourceError,
} from './classes';

/**
 * Async error wrapper
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
export function asyncErrorHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create validation error from validation result
 * @param {Object} validationResult - Validation result object
 * @returns {ValidationError} Validation error
 */
export function createValidationError(validationResult) {
  const error = new ValidationError(
    'Validation failed',
    validationResult.errors,
  );
  return error;
}

/**
 * Assert condition and throw error if false
 * @param {boolean} condition - Condition to check
 * @param {Error|string} error - Error to throw or error message
 * @param {number} statusCode - HTTP status code (if error is string)
 */
export function assert(condition, error, statusCode = HTTP_STATUS.BAD_REQUEST) {
  if (!condition) {
    if (typeof error === 'string') {
      throw new HttpError(error, statusCode);
    }
    throw error;
  }
}

/**
 * Throw not found error for resource
 * @param {string} resource - Resource name
 * @param {*} id - Resource ID
 */
export function throwNotFound(resource, id = null) {
  throw new ResourceError(resource, id);
}

/**
 * Throw unauthorized error
 * @param {string} message - Error message
 */
export function throwUnauthorized(message = 'Authentication required') {
  throw new UnauthorizedError(message);
}

/**
 * Throw forbidden error
 * @param {string} message - Error message
 */
export function throwForbidden(message = 'Access denied') {
  throw new ForbiddenError(message);
}

/**
 * Throw validation error
 * @param {string} message - Error message
 * @param {Array} errors - Validation errors
 */
export function throwValidation(message = 'Validation failed', errors = []) {
  throw new ValidationError(message, errors);
}
