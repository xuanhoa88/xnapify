/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { randomUUID } from 'crypto';

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
  SERVICE_UNAVAILABLE: 503,
});

/**
 * Safe keys allowed in public error responses
 */
const SAFE_ERROR_KEYS = new Set(['message', 'field', 'code', 'type', 'reason']);

/**
 * Dangerous keys that should never be exposed
 */
const BLOCKED_KEYS = new Set([
  'stack',
  'trace',
  'sql',
  'query',
  'path',
  'password',
  'token',
  'secret',
]);

/**
 * Sanitizes error objects for public API responses
 * @param {*} error - Error to sanitize
 * @returns {Object|Array|null} Sanitized error or null
 */
function sanitizeError(error) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  // Handle arrays (validation errors)
  if (Array.isArray(error)) {
    return error.map(sanitizeError).filter(Boolean);
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(error)) {
    // Skip blocked keys
    if (BLOCKED_KEYS.has(key)) continue;

    // Only include safe keys
    if (SAFE_ERROR_KEYS.has(key)) {
      sanitized[key] = typeof value === 'string' ? value : String(value);
    }
  }

  // Ensure there's always a message
  if (!sanitized.message) {
    sanitized.message = 'Invalid request';
  }

  return sanitized;
}

/**
 * Normalizes errors into public/internal format
 * @param {*} error - Error to normalize
 * @returns {Object} { public, internal }
 */
function normalizeError(error) {
  if (!error) {
    return { public: null, internal: null };
  }

  // Native Error instances - hide details
  if (error instanceof Error) {
    return {
      public: { message: 'Internal server error' },
      internal: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    };
  }

  // Arrays (validation errors) - safe to expose
  if (Array.isArray(error)) {
    const sanitized = sanitizeError(error);
    return { public: sanitized, internal: error };
  }

  // Plain objects - sanitize
  if (typeof error === 'object') {
    return {
      public: sanitizeError(error),
      internal: error,
    };
  }

  // Primitives - convert to object
  return {
    public: { message: String(error) },
    internal: error,
  };
}

/**
 * Creates standard response structure
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

  if (data !== null && data !== undefined) {
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
 * Sends success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {Object} meta - Additional metadata
 */
export function sendSuccess(
  res,
  data = null,
  statusCode = HTTP_STATUS.OK,
  message = null,
  meta = null,
) {
  return res.status(statusCode).json(createResponse(true, data, message, meta));
}

/**
 * Sends error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {*} errors - Error details (sanitized automatically)
 * @param {Object} meta - Additional metadata
 */
export function sendError(
  res,
  message,
  statusCode = HTTP_STATUS.BAD_REQUEST,
  errors = null,
  meta = null,
) {
  const errorId = randomUUID();
  const response = createResponse(false, null, message, meta);

  // Log internal errors in development
  if (__DEV__ && errors) {
    console.error(`[Error ${errorId}]:`, errors);
  }

  // Normalize and sanitize errors
  const { public: publicError, internal: internalError } =
    normalizeError(errors);

  if (publicError) {
    response.errors = publicError;
  }

  response.errorId = errorId;

  // Log critical errors in production
  if (!__DEV__ && statusCode >= 500) {
    console.error(`[Error ${errorId}]:`, internalError || message);
  }

  return res.status(statusCode).json(response);
}

// ============================================================================
// Success Response Helpers
// ============================================================================

export function sendCreated(res, data, message = 'Resource created') {
  return sendSuccess(res, data, HTTP_STATUS.CREATED, message);
}

export function sendAccepted(res, data = null, message = 'Request accepted') {
  return sendSuccess(res, data, HTTP_STATUS.ACCEPTED, message);
}

export function sendNoContent(res) {
  return res.status(HTTP_STATUS.NO_CONTENT).end();
}

// ============================================================================
// Error Response Helpers
// ============================================================================

export function sendBadRequest(res, message = 'Bad request', errors = null) {
  return sendError(res, message, HTTP_STATUS.BAD_REQUEST, errors);
}

export function sendValidationError(
  res,
  errors,
  message = 'Validation failed',
) {
  return sendError(res, message, HTTP_STATUS.UNPROCESSABLE_ENTITY, errors);
}

export function sendUnauthorized(res, message = 'Authentication required') {
  return sendError(res, message, HTTP_STATUS.UNAUTHORIZED);
}

export function sendForbidden(res, message = 'Access forbidden') {
  return sendError(res, message, HTTP_STATUS.FORBIDDEN);
}

export function sendNotFound(res, message = 'Resource not found') {
  return sendError(res, message, HTTP_STATUS.NOT_FOUND);
}

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

export function sendConflict(
  res,
  message = 'Resource conflict',
  errors = null,
) {
  return sendError(res, message, HTTP_STATUS.CONFLICT, errors);
}

export function sendRateLimit(res, message = 'Too many requests', meta = null) {
  return sendError(res, message, HTTP_STATUS.TOO_MANY_REQUESTS, null, meta);
}

export function sendServerError(
  res,
  message = 'Internal server error',
  error = null,
) {
  return sendError(res, message, HTTP_STATUS.INTERNAL_SERVER_ERROR, error);
}

export function sendServiceUnavailable(
  res,
  message = 'Service unavailable',
  meta = null,
) {
  return sendError(res, message, HTTP_STATUS.SERVICE_UNAVAILABLE, null, meta);
}

// ============================================================================
// Specialized Response Helpers
// ============================================================================

/**
 * Sends paginated response
 * @param {Object} res - Express response object
 * @param {Array} items - Array of items
 * @param {Object} pagination - Pagination metadata
 */
export function sendPaginated(res, items, pagination, message = 'Success') {
  const { page, limit, total } = pagination;
  const pages = Math.ceil(total / limit);

  const meta = {
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    },
  };

  return sendSuccess(res, { items }, HTTP_STATUS.OK, message, meta);
}

/**
 * Sends file download
 * @param {Object} res - Express response object
 * @param {string} filePath - Path to file
 * @param {string} fileName - Download filename (optional)
 * @param {Object} options - sendFile options
 */
export function sendFile(res, filePath, fileName = null, options = {}) {
  if (fileName) {
    // Sanitize filename to prevent header injection
    const safe = fileName.replace(/["'\r\n]/g, '');
    res.set('Content-Disposition', `attachment; filename="${safe}"`);
  }

  return res.sendFile(filePath, options, err => {
    if (err && !res.headersSent) {
      sendServerError(res, 'Failed to send file');
    }
  });
}

/**
 * Sends redirect
 * @param {Object} res - Express response object
 * @param {string} url - Redirect URL
 * @param {boolean} permanent - Use 301 instead of 302
 */
export function sendRedirect(res, url, permanent = false) {
  const status = permanent ? 301 : HTTP_STATUS.FOUND;
  return res.redirect(status, url);
}

/**
 * Sends stream response
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

  Object.entries(headers).forEach(([key, value]) => {
    res.set(key, value);
  });

  stream.on('error', err => {
    if (!res.headersSent) {
      console.error('Stream error:', err);
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(createResponse(false, null, 'Stream error'));
    }
  });

  return stream.pipe(res);
}
