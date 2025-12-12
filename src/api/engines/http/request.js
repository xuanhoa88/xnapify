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
 * @returns {string} Search query
 */
export function getSearch(req) {
  const query = req.query.search || req.query.q || '';
  return query;
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
