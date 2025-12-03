/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { sendError, sendMethodNotAllowed, HTTP_STATUS } from './response';

/**
 * Async wrapper for Express middleware
 * Catches async errors and passes them to Express error handler
 * @param {Function} fn - Async middleware function
 * @returns {Function} Wrapped middleware
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validate request body middleware
 * @param {Object} schema - Validation schema
 * @param {Array} schema.required - Required fields
 * @param {Array} schema.optional - Optional fields
 * @param {Object} schema.rules - Validation rules
 * @returns {Function} Middleware function
 */
export function validateBody(schema = {}) {
  return (req, res, next) => {
    const { required = [], rules = {} } = schema;
    const body = req.body || {};
    const errors = [];

    // Check required fields
    required.forEach(field => {
      if (body[field] == null || body[field] === '') {
        errors.push(`Field '${field}' is required`);
      }
    });

    // Validate field rules
    Object.entries(rules).forEach(([field, rule]) => {
      const value = body[field];

      if (value != null) {
        if (rule.type && typeof value !== rule.type) {
          errors.push(`Field '${field}' must be of type ${rule.type}`);
        }

        if (rule.minLength && value.length < rule.minLength) {
          errors.push(
            `Field '${field}' must be at least ${rule.minLength} characters`,
          );
        }

        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(
            `Field '${field}' must be at most ${rule.maxLength} characters`,
          );
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`Field '${field}' format is invalid`);
        }

        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(
            `Field '${field}' must be one of: ${rule.enum.join(', ')}`,
          );
        }
      }
    });

    if (errors.length > 0) {
      return sendError(
        res,
        'Validation failed',
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        errors,
      );
    }

    next();
  };
}

/**
 * Validate query parameters middleware
 * @param {Object} schema - Query validation schema
 * @returns {Function} Middleware function
 */
export function validateQuery(schema = {}) {
  return (req, res, next) => {
    const { allowed = [], rules = {} } = schema;
    const query = req.query || {};
    const errors = [];

    // Check for unexpected query parameters
    if (allowed.length > 0) {
      Object.keys(query).forEach(key => {
        if (!allowed.includes(key)) {
          errors.push(`Query parameter '${key}' is not allowed`);
        }
      });
    }

    // Validate query rules
    Object.entries(rules).forEach(([field, rule]) => {
      const value = query[field];

      if (value != null) {
        if (rule.type === 'number') {
          const num = parseInt(value, 10);
          if (isNaN(num)) {
            errors.push(`Query parameter '${field}' must be a number`);
          } else if (rule.min && num < rule.min) {
            errors.push(
              `Query parameter '${field}' must be at least ${rule.min}`,
            );
          } else if (rule.max && num > rule.max) {
            errors.push(
              `Query parameter '${field}' must be at most ${rule.max}`,
            );
          }
        }

        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(
            `Query parameter '${field}' must be one of: ${rule.enum.join(', ')}`,
          );
        }
      }
    });

    if (errors.length > 0) {
      return sendError(
        res,
        'Invalid query parameters',
        HTTP_STATUS.BAD_REQUEST,
        errors,
      );
    }

    next();
  };
}

/**
 * HTTP method restriction middleware
 * @param {Array} allowedMethods - Allowed HTTP methods
 * @returns {Function} Middleware function
 */
export function allowMethods(allowedMethods = []) {
  return (req, res, next) => {
    if (!allowedMethods.includes(req.method)) {
      return sendMethodNotAllowed(res, allowedMethods);
    }
    next();
  };
}

/**
 * Content-Type validation middleware
 * @param {Array} allowedTypes - Allowed content types
 * @returns {Function} Middleware function
 */
export function requireContentType(allowedTypes = ['application/json']) {
  return (req, res, next) => {
    const contentType = req.get('Content-Type');

    if (
      !contentType ||
      !allowedTypes.some(type => contentType.includes(type))
    ) {
      return sendError(
        res,
        `Content-Type must be one of: ${allowedTypes.join(', ')}`,
        HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    next();
  };
}

/**
 * Request timeout middleware
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Function} Middleware function
 */
export function requestTimeout(timeout = 30000) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        sendError(res, 'Request timeout', HTTP_STATUS.REQUEST_TIMEOUT);
      }
    }, timeout);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
}

/**
 * Request size limit middleware
 * @param {number} maxSize - Maximum request size in bytes
 * @returns {Function} Middleware function
 */
export function limitRequestSize(maxSize = 1024 * 1024) {
  // 1MB default
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length'), 10);

    if (contentLength && contentLength > maxSize) {
      return sendError(
        res,
        `Request too large. Maximum size: ${maxSize} bytes`,
        HTTP_STATUS.PAYLOAD_TOO_LARGE,
      );
    }

    next();
  };
}

/**
 * CORS preflight handler
 * @param {Object} options - CORS options
 * @returns {Function} Middleware function
 */
export function handleCors(options = {}) {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
  } = options;

  return (req, res, next) => {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', methods.join(', '));
    res.set('Access-Control-Allow-Headers', headers.join(', '));

    if (credentials) {
      res.set('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      return res.status(HTTP_STATUS.NO_CONTENT).end();
    }

    next();
  };
}

/**
 * Request logging middleware
 * @param {Object} options - Logging options
 * @returns {Function} Middleware function
 */
export function requestLogger(options = {}) {
  const { includeBody = false, includeHeaders = false } = options;

  return (req, res, next) => {
    const start = Date.now();

    const logData = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      user_agent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    };

    if (includeHeaders) {
      logData.headers = req.headers;
    }

    if (includeBody && req.body) {
      logData.body = req.body;
    }

    res.on('finish', () => {
      logData.statusCode = res.statusCode;
      logData.duration = Date.now() - start;
    });

    next();
  };
}

/**
 * Cache control middleware
 * @param {Object} options - Cache options
 * @returns {Function} Middleware function
 */
export function cacheControl(options = {}) {
  const {
    maxAge = 3600, // 1 hour
    public: isPublic = true,
    noCache = false,
    noStore = false,
  } = options;

  return (req, res, next) => {
    if (noStore) {
      res.set('Cache-Control', 'no-store');
    } else if (noCache) {
      res.set('Cache-Control', 'no-cache');
    } else {
      const visibility = isPublic ? 'public' : 'private';
      res.set('Cache-Control', `${visibility}, max-age=${maxAge}`);
    }

    next();
  };
}

/**
 * Security headers middleware
 * @param {Object} options - Security options
 * @returns {Function} Middleware function
 */
export function securityHeaders(options = {}) {
  const {
    noSniff = true,
    frameOptions = 'DENY',
    xssProtection = true,
    hsts = true,
  } = options;

  return (req, res, next) => {
    if (noSniff) {
      res.set('X-Content-Type-Options', 'nosniff');
    }

    if (frameOptions) {
      res.set('X-Frame-Options', frameOptions);
    }

    if (xssProtection) {
      res.set('X-XSS-Protection', '1; mode=block');
    }

    if (hsts && req.secure) {
      res.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }

    next();
  };
}
