/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = Object.freeze({
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client Error
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Error
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
});

/**
 * Standard response format
 * @param {boolean} success - Success status
 * @param {*} data - Response data
 * @param {string} message - Response message
 * @param {Object} meta - Additional metadata
 * @returns {Object} Formatted response
 */
export function createResponse(
  success,
  data = null,
  message = null,
  meta = null,
) {
  const response = {
    success,
    timestamp: new Date().toISOString(),
  };

  if (data != null) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  return response;
}

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {Object} meta - Additional metadata
 */
export function sendSuccess(
  res,
  data = null,
  message = null,
  statusCode = HTTP_STATUS.OK,
  meta = null,
) {
  return res.status(statusCode).json(createResponse(true, data, message, meta));
}

/**
 * Send created response (201)
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} message - Success message
 * @param {Object} meta - Additional metadata
 */
export function sendCreated(
  res,
  data,
  message = 'Resource created successfully',
  meta = null,
) {
  return sendSuccess(res, data, message, HTTP_STATUS.CREATED, meta);
}

/**
 * Send accepted response (202)
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Acceptance message
 * @param {Object} meta - Additional metadata
 */
export function sendAccepted(
  res,
  data = null,
  message = 'Request accepted for processing',
  meta = null,
) {
  return sendSuccess(res, data, message, HTTP_STATUS.ACCEPTED, meta);
}

/**
 * Send no content response (204)
 * @param {Object} res - Express response object
 */
export function sendNoContent(res) {
  return res.status(HTTP_STATUS.NO_CONTENT).end();
}

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {Object} errors - Validation errors (optional)
 * @param {Object} meta - Additional metadata
 */
export function sendError(
  res,
  message,
  statusCode = HTTP_STATUS.BAD_REQUEST,
  errors = null,
  meta = null,
) {
  const response = createResponse(false, null, message, meta);

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send validation error response (422)
 * @param {Object} res - Express response object
 * @param {Object} errors - Validation errors
 * @param {string} message - Error message
 */
export function sendValidationError(
  res,
  errors,
  message = 'Validation failed',
) {
  return sendError(res, message, HTTP_STATUS.UNPROCESSABLE_ENTITY, errors);
}

/**
 * Send unauthorized error response (401)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export function sendUnauthorized(res, message = 'Authentication required') {
  return sendError(res, message, HTTP_STATUS.UNAUTHORIZED);
}

/**
 * Send forbidden error response (403)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export function sendForbidden(res, message = 'Access forbidden') {
  return sendError(res, message, HTTP_STATUS.FORBIDDEN);
}

/**
 * Send not found error response (404)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export function sendNotFound(res, message = 'Resource not found') {
  return sendError(res, message, HTTP_STATUS.NOT_FOUND);
}

/**
 * Send method not allowed error response (405)
 * @param {Object} res - Express response object
 * @param {Array} allowedMethods - Allowed HTTP methods
 * @param {string} message - Error message
 */
export function sendMethodNotAllowed(
  res,
  allowedMethods = [],
  message = 'Method not allowed',
) {
  if (allowedMethods.length > 0) {
    res.set('Allow', allowedMethods.join(', '));
  }
  return sendError(res, message, HTTP_STATUS.METHOD_NOT_ALLOWED);
}

/**
 * Send conflict error response (409)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export function sendConflict(res, message = 'Resource conflict') {
  return sendError(res, message, HTTP_STATUS.CONFLICT);
}

/**
 * Send rate limit error response (429)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object} meta - Rate limit metadata (limit, remaining, reset)
 */
export function sendRateLimit(res, message = 'Too many requests', meta = null) {
  return sendError(res, message, HTTP_STATUS.TOO_MANY_REQUESTS, null, meta);
}

/**
 * Send internal server error response (500)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export function sendServerError(res, message = 'Internal server error') {
  return sendError(res, message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
}

/**
 * Send service unavailable error response (503)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object} meta - Service metadata (retryAfter, etc.)
 */
export function sendServiceUnavailable(
  res,
  message = 'Service temporarily unavailable',
  meta = null,
) {
  return sendError(res, message, HTTP_STATUS.SERVICE_UNAVAILABLE, null, meta);
}

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {Array} items - Array of items
 * @param {Object} pagination - Pagination metadata
 * @param {number} pagination.page - Current page
 * @param {number} pagination.limit - Items per page
 * @param {number} pagination.total - Total items
 * @param {number} pagination.pages - Total pages
 * @param {string} message - Success message
 */
export function sendPaginated(
  res,
  items,
  pagination,
  message = 'Data retrieved successfully',
) {
  const meta = {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: pagination.pages,
      hasNext: pagination.page < pagination.pages,
      hasPrev: pagination.page > 1,
    },
  };

  return sendSuccess(res, { items }, message, HTTP_STATUS.OK, meta);
}

/**
 * Send file response
 * @param {Object} res - Express response object
 * @param {string} filePath - Path to file
 * @param {string} fileName - Download filename
 * @param {Object} options - Additional options
 */
export function sendFile(res, filePath, fileName = null, options = {}) {
  if (fileName) {
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);
  }

  return res.sendFile(filePath, options);
}

/**
 * Send redirect response
 * @param {Object} res - Express response object
 * @param {string} url - Redirect URL
 * @param {number} statusCode - HTTP status code (default: 302)
 */
export function sendRedirect(res, url, statusCode = HTTP_STATUS.FOUND) {
  return res.redirect(statusCode, url);
}

/**
 * Send JSON response with custom headers
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {Object} headers - Custom headers
 * @param {number} statusCode - HTTP status code
 */
export function sendJson(res, data, headers = {}, statusCode = HTTP_STATUS.OK) {
  // Set custom headers
  Object.entries(headers).forEach(([key, value]) => {
    res.set(key, value);
  });

  return res.status(statusCode).json(data);
}

/**
 * Send stream response
 * @param {Object} res - Express response object
 * @param {Stream} stream - Readable stream
 * @param {string} contentType - Content type
 * @param {Object} headers - Additional headers
 */
export function sendStream(
  res,
  stream,
  contentType = 'application/octet-stream',
  headers = {},
) {
  res.set('Content-Type', contentType);

  // Set additional headers
  Object.entries(headers).forEach(([key, value]) => {
    res.set(key, value);
  });

  return stream.pipe(res);
}
