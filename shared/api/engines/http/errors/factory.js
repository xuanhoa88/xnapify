/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  MethodNotAllowedError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  ResourceError,
  BusinessLogicError,
  ExternalServiceError,
} from './classes';

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
