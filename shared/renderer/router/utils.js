/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ROUTE_SEPARATOR } from './constants';

/**
 * Logs a message with the [Router] prefix in non-production environments.
 * @param {string} message - The message to log
 * @param {'log'|'warn'|'error'} [level='log'] - Console log level
 */
export function log(message, level = 'log') {
  if (__DEV__) {
    console[level](`[Router] ${message}`);
  }
}

/**
 * Custom error class for router-specific errors.
 * Extends native Error with HTTP status, machine-readable code, and extra details.
 * @class
 */
export class RouterError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {number} [status=500] - HTTP status code
   * @param {Object} [options={}] - Additional error properties
   * @param {string} [options.code] - Machine-readable error code (e.g. 'ROUTE_NOT_FOUND')
   * @param {Object} [options.details] - Arbitrary metadata attached to the error
   */
  constructor(message, status = 500, { code, details } = {}) {
    super(message);
    this.name = 'RouterError';
    this.status = status;
    this.code = code || 'ROUTER_ERROR';
    this.details = details || {};
  }
}

/**
 * Creates a RouterError with the given message, status, and optional details.
 * @param {string} message
 * @param {number} [status=500]
 * @param {Object} [options={}]
 * @returns {RouterError}
 */
export function createError(message, status = 500, options = {}) {
  return new RouterError(message, status, options);
}

/**
 * Normalizes any thrown value into a consistent RouterError shape.
 * Handles: Error instances, string throws, objects with status/message, null/undefined.
 * @param {*} err - The thrown value to normalize
 * @returns {RouterError}
 */
export function normalizeError(err) {
  if (err instanceof RouterError) return err;

  if (err instanceof Error) {
    const normalized = new RouterError(
      err.message,
      err.status || err.statusCode || 500,
      {
        code: err.code || 'INTERNAL_ERROR',
        details: err.details || {},
      },
    );
    normalized.stack = err.stack;
    return normalized;
  }

  if (typeof err === 'string') {
    return new RouterError(err, 500, { code: 'INTERNAL_ERROR' });
  }

  if (err && typeof err === 'object') {
    return new RouterError(
      err.message || 'Unknown error',
      err.status || err.statusCode || 500,
      {
        code: err.code || 'INTERNAL_ERROR',
        details: err.details || {},
      },
    );
  }

  return new RouterError('Internal Server Error', 500, {
    code: 'INTERNAL_ERROR',
  });
}

/**
 * Normalizes a URL path by deduplicating slashes and stripping trailing slash.
 * Throws on path traversal attempts.
 * @param {string} path - The raw path string
 * @returns {string} Normalized path
 * @throws {RouterError} If path contains '..' traversal
 */
export function normalizePath(path) {
  if (typeof path !== 'string') return ROUTE_SEPARATOR;
  if (path.includes('..')) {
    throw createError(`Path traversal not allowed: "${path}"`, 400);
  }

  let normalized = (ROUTE_SEPARATOR + path).replace(/\/+/g, ROUTE_SEPARATOR);
  if (normalized.length > 1 && normalized.endsWith(ROUTE_SEPARATOR)) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Safely decodes a URI component, returning the original on failure.
 * @param {string} val - The value to decode
 * @returns {string} Decoded value
 */
export function decodeUrl(val) {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

/**
 * Extracts the first segment from a pathname (the module/root segment).
 * @param {string} pathname - The full pathname
 * @returns {string|null} First segment or null if empty
 */
export function getRootSegment(pathname) {
  const parts = pathname.split(ROUTE_SEPARATOR).filter(Boolean);
  return parts[0] || null;
}

/**
 * Checks if a route node is a descendant of a parent node.
 * @param {Object} parent - The potential ancestor route
 * @param {Object} child - The route to check ancestry for
 * @returns {boolean}
 */
export function isDescendant(parent, child) {
  let current = child;
  while (current) {
    current = current.parent;
    if (current === parent) return true;
  }
  return false;
}
