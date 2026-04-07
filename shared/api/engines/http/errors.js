/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { HTTP_STATUS } from './constants';

/**
 * Base HTTP Error class
 */
export class HttpError extends Error {
  constructor(
    message,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code = null,
  ) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code || 'HTTP_ERROR';
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST') {
    super(message, HTTP_STATUS.BAD_REQUEST, code);
    this.name = 'BadRequestError';
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, HTTP_STATUS.UNAUTHORIZED, code);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, HTTP_STATUS.FORBIDDEN, code);
    this.name = 'ForbiddenError';
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', code = 'NOT_FOUND') {
    super(message, HTTP_STATUS.NOT_FOUND, code);
    this.name = 'NotFoundError';
  }
}

/**
 * Method Not Allowed Error (405)
 */
export class MethodNotAllowedError extends HttpError {
  constructor(
    message = 'Method Not Allowed',
    allowedMethods = [],
    code = 'METHOD_NOT_ALLOWED',
  ) {
    super(message, HTTP_STATUS.METHOD_NOT_ALLOWED, code);
    this.name = 'MethodNotAllowedError';
    this.allowedMethods = allowedMethods;
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends HttpError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, HTTP_STATUS.CONFLICT, code);
    this.name = 'ConflictError';
  }
}

/**
 * Validation Error (422)
 */
export class ValidationError extends HttpError {
  constructor(
    message = 'Validation Failed',
    errors = [],
    code = 'VALIDATION_ERROR',
  ) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, code);
    this.name = 'ValidationError';
    this.errors = errors;
  }

  addError(field, message, value = null) {
    this.errors.push({ field, message, value });
    return this;
  }

  getErrors() {
    return this.errors;
  }

  getErrorsForField(field) {
    return this.errors.filter(error => error.field === field);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors,
    };
  }
}

/**
 * Too Many Requests Error (429)
 */
export class TooManyRequestsError extends HttpError {
  constructor(
    message = 'Too Many Requests',
    retryAfter = null,
    code = 'TOO_MANY_REQUESTS',
  ) {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, code);
    this.name = 'TooManyRequestsError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends HttpError {
  constructor(
    message = 'Internal Server Error',
    code = 'INTERNAL_SERVER_ERROR',
  ) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, code);
    this.name = 'InternalServerError';
  }
}

/**
 * Service Unavailable Error (503)
 */
export class ServiceUnavailableError extends HttpError {
  constructor(
    message = 'Service Unavailable',
    retryAfter = null,
    code = 'SERVICE_UNAVAILABLE',
  ) {
    super(message, HTTP_STATUS.SERVICE_UNAVAILABLE, code);
    this.name = 'ServiceUnavailableError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Database Error
 */
export class DatabaseError extends InternalServerError {
  constructor(
    message = 'Database Error',
    originalError = null,
    code = 'DATABASE_ERROR',
  ) {
    super(message, code);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

/**
 * Authentication Error
 */
export class AuthenticationError extends UnauthorizedError {
  constructor(
    message = 'Authentication Failed',
    code = 'AUTHENTICATION_ERROR',
  ) {
    super(message, code);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization Error
 */
export class AuthorizationError extends ForbiddenError {
  constructor(message = 'Access Denied', code = 'AUTHORIZATION_ERROR') {
    super(message, code);
    this.name = 'AuthorizationError';
  }
}

/**
 * Resource Error
 */
export class ResourceError extends NotFoundError {
  constructor(resource = 'Resource', id = null, code = 'RESOURCE_NOT_FOUND') {
    const message = id
      ? `${resource} with ID '${id}' not found`
      : `${resource} not found`;
    super(message, code);
    this.name = 'ResourceError';
    this.resource = resource;
    this.resourceId = id;
  }
}

/**
 * Business Logic Error
 */
export class BusinessLogicError extends BadRequestError {
  constructor(message = 'Business Logic Error', code = 'BUSINESS_LOGIC_ERROR') {
    super(message, code);
    this.name = 'BusinessLogicError';
  }
}

/**
 * External Service Error
 */
export class ExternalServiceError extends InternalServerError {
  constructor(
    service = 'External Service',
    message = 'External service error',
    code = 'EXTERNAL_SERVICE_ERROR',
  ) {
    super(message, code);
    this.name = 'ExternalServiceError';
    this.service = service;
  }
}

/**
 * Error factory functions
 */
export const createError = Object.freeze({
  badRequest: (message, code) => new BadRequestError(message, code),
  unauthorized: (message, code) => new UnauthorizedError(message, code),
  forbidden: (message, code) => new ForbiddenError(message, code),
  notFound: (message, code) => new NotFoundError(message, code),
  methodNotAllowed: (message, allowedMethods, code) =>
    new MethodNotAllowedError(message, allowedMethods, code),
  conflict: (message, code) => new ConflictError(message, code),
  validation: (message, errors, code) =>
    new ValidationError(message, errors, code),
  tooManyRequests: (message, retryAfter, code) =>
    new TooManyRequestsError(message, retryAfter, code),
  internalServer: (message, code) => new InternalServerError(message, code),
  serviceUnavailable: (message, retryAfter, code) =>
    new ServiceUnavailableError(message, retryAfter, code),
  database: (message, originalError, code) =>
    new DatabaseError(message, originalError, code),
  authentication: (message, code) => new AuthenticationError(message, code),
  authorization: (message, code) => new AuthorizationError(message, code),
  resource: (resource, id, code) => new ResourceError(resource, id, code),
  businessLogic: (message, code) => new BusinessLogicError(message, code),
  externalService: (service, message, code) =>
    new ExternalServiceError(service, message, code),
});

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

export class EngineError extends HttpError {}
