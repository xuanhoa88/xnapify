/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  HttpError,
  BadRequestError,
  NotFoundError,
  ValidationError,
  TooManyRequestsError,
  MethodNotAllowedError,
  DatabaseError,
} from './classes';

/**
 * Error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function errorHandler(err, req, res, next) {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Log error for debugging
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    user_agent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });

  // Handle known HTTP errors
  if (err instanceof HttpError) {
    const response = {
      success: false,
      error: err.message,
      code: err.code,
      timestamp: err.timestamp,
    };

    // Add validation errors if present
    if (err instanceof ValidationError && err.errors.length > 0) {
      response.errors = err.errors;
    }

    // Add retry-after header for rate limiting
    if (err instanceof TooManyRequestsError && err.retryAfter) {
      res.set('Retry-After', err.retryAfter);
    }

    // Add allowed methods header for method not allowed
    if (err instanceof MethodNotAllowedError && err.allowedMethods.length > 0) {
      res.set('Allow', err.allowedMethods.join(', '));
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle Sequelize/Database errors
  if (err.name && err.name.includes('Sequelize')) {
    const dbError = new DatabaseError('Database operation failed', err);
    return res.status(dbError.statusCode).json({
      success: false,
      error: dbError.message,
      code: dbError.code,
      timestamp: dbError.timestamp,
    });
  }

  // Handle syntax errors (malformed JSON)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    const syntaxError = new BadRequestError('Invalid JSON format');
    return res.status(syntaxError.statusCode).json({
      success: false,
      error: syntaxError.message,
      code: syntaxError.code,
      timestamp: syntaxError.timestamp,
    });
  }

  // Pass unhandled errors to server.js error handler
  next(err);
}

/**
 * Not found handler middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function notFoundHandler(req, res, next) {
  const error = new NotFoundError(
    `Route ${req.method} ${req.originalUrl} not found`,
  );
  next(error);
}
