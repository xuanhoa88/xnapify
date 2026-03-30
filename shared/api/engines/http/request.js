/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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
 * Get client IP address (proxy-aware)
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
export function getClientIP(req) {
  // Check X-Forwarded-For header for proxied requests
  const forwarded = req.get('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || '0.0.0.0';
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
  return req.is('application/json') || false;
}

/**
 * Get request protocol (http/https)
 * @param {Object} req - Express request object
 * @returns {string} Protocol
 */
export function getProtocol(req) {
  return req.protocol || 'http';
}

/**
 * Get base URL for generating absolute URLs
 * @param {Object} req - Express request object
 * @returns {string} Base URL (e.g., "https://example.com")
 */
export function getBaseUrl(req) {
  const protocol = getProtocol(req);
  const host = req.get('Host') || req.hostname || 'localhost';
  return `${protocol}://${host}`;
}

/**
 * Get Origin header for CORS validation
 * @param {Object} req - Express request object
 * @returns {string|null} Origin header value or null
 */
export function getOrigin(req) {
  return req.get('Origin') || null;
}

/**
 * Extract Authorization token from request
 * @param {Object} req - Express request object
 * @param {string} scheme - Authorization scheme (default: 'Bearer')
 * @returns {string|null} Token or null if not present/invalid
 */
export function getAuthorization(req, scheme = 'Bearer') {
  const header = req.get('Authorization');
  if (!header) {
    return null;
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== scheme) {
    return null;
  }

  return parts[1];
}
