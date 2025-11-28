/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Extract pagination parameters from request query
 * @param {Object} req - Express request object
 * @param {Object} defaults - Default pagination values
 * @returns {Object} Pagination parameters
 */
export function getPagination(
  req,
  defaults = { page: 1, limit: 10, maxLimit: 100 },
) {
  const page = Math.max(1, parseInt(req.query.page, 10) || defaults.page);
  const limit = Math.min(
    defaults.maxLimit,
    Math.max(1, parseInt(req.query.limit, 10) || defaults.limit),
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Extract sorting parameters from request query
 * @param {Object} req - Express request object
 * @param {Array} allowedFields - Allowed fields for sorting
 * @param {string} defaultSort - Default sort field
 * @param {string} defaultOrder - Default sort order (asc/desc)
 * @returns {Object} Sort parameters
 */
export function getSorting(
  req,
  allowedFields = [],
  defaultSort = 'id',
  defaultOrder = 'asc',
) {
  const sortBy = req.query.sortBy || defaultSort;
  const sortOrder = req.query.sortOrder || defaultOrder;

  // Validate sort field
  const field = allowedFields.includes(sortBy) ? sortBy : defaultSort;
  const order = ['asc', 'desc'].includes(sortOrder.toLowerCase())
    ? sortOrder.toLowerCase()
    : defaultOrder;

  return { field, order };
}

/**
 * Extract filtering parameters from request query
 * @param {Object} req - Express request object
 * @param {Array} allowedFilters - Allowed filter fields
 * @returns {Object} Filter parameters
 */
export function getFilters(req, allowedFilters = []) {
  const filters = {};

  allowedFilters.forEach(field => {
    if (req.query[field] != null) {
      filters[field] = req.query[field];
    }
  });

  return filters;
}

/**
 * Extract search parameters from request query
 * @param {Object} req - Express request object
 * @param {Array} searchFields - Fields to search in
 * @returns {Object} Search parameters
 */
export function getSearch(req, searchFields = []) {
  const query = req.query.search || req.query.q || '';
  const fields = searchFields.length > 0 ? searchFields : ['name', 'title'];

  return { query: query.trim(), fields };
}

/**
 * Get client IP address
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
export function getClientIP(req) {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket && req.connection.socket.remoteAddress) ||
    '0.0.0.0'
  );
}

/**
 * Get user agent information
 * @param {Object} req - Express request object
 * @returns {string} User agent string
 */
export function getUserAgent(req) {
  return req.get('User-Agent') || 'Unknown';
}

/**
 * Check if request is AJAX
 * @param {Object} req - Express request object
 * @returns {boolean} True if AJAX request
 */
export function isAjax(req) {
  return req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest';
}

/**
 * Check if request is JSON
 * @param {Object} req - Express request object
 * @returns {boolean} True if JSON request
 */
export function isJson(req) {
  return (
    req.is('application/json') || req.get('Content-Type') === 'application/json'
  );
}

/**
 * Get request protocol (http/https)
 * @param {Object} req - Express request object
 * @returns {string} Protocol
 */
export function getProtocol(req) {
  return req.protocol || (req.secure ? 'https' : 'http');
}

/**
 * Get full request URL
 * @param {Object} req - Express request object
 * @returns {string} Full URL
 */
export function getFullUrl(req) {
  return `${getProtocol(req)}://${req.get('host')}${req.originalUrl}`;
}

/**
 * Extract bearer token from Authorization header
 * @param {Object} req - Express request object
 * @returns {string|null} Bearer token or null
 */
export function getBearerToken(req) {
  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Parse request body safely
 * @param {Object} req - Express request object
 * @param {Array} requiredFields - Required fields in body
 * @param {Array} optionalFields - Optional fields in body
 * @returns {Object} Parsed body with validation
 */
export function parseBody(req, requiredFields = [], optionalFields = []) {
  const body = req.body || {};
  const result = { data: {}, errors: [] };

  // Check required fields
  requiredFields.forEach(field => {
    if (body[field] == null || body[field] === '') {
      result.errors.push(`Field '${field}' is required`);
    } else {
      result.data[field] = body[field];
    }
  });

  // Add optional fields if present
  optionalFields.forEach(field => {
    if (body[field] != null) {
      result.data[field] = body[field];
    }
  });

  result.isValid = result.errors.length === 0;
  return result;
}

/**
 * Sanitize string input
 * @param {string} input - Input string
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
export function sanitizeString(input, options = {}) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return '';
  }

  let sanitized = input.trim();

  if (options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  if (options.removeHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  if (options.removeSpecialChars) {
    sanitized = sanitized.replace(/[^\w\s-]/g, '');
  }

  return sanitized;
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid email
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 * @param {string} url - URL string
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get request metadata for logging
 * @param {Object} req - Express request object
 * @returns {Object} Request metadata
 */
export function getRequestMetadata(req) {
  return {
    method: req.method,
    url: req.originalUrl,
    ip: getClientIP(req),
    user_agent: getUserAgent(req),
    timestamp: new Date().toISOString(),
    protocol: getProtocol(req),
    isAjax: isAjax(req),
    isJson: isJson(req),
  };
}
