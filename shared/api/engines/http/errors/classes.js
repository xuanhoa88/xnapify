/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { HTTP_STATUS } from '../constants';

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
    this.code = code;
    this.timestamp = new Date().toISOString();
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
