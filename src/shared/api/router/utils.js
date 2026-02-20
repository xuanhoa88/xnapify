/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ROUTE_SEPARATOR } from './constants';

export function log(message, level = 'log') {
  if (process.env.NODE_ENV !== 'production') {
    console[level](`[ApiRouter] ${message}`);
  }
}

export function createError(message, status, details = {}) {
  const error = new Error(message);
  error.name = 'RouterError';
  error.status = status;
  Object.assign(error, details);
  return error;
}

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

export function decodeUrl(val) {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

export function getRootSegment(pathname) {
  const parts = pathname.split(ROUTE_SEPARATOR).filter(Boolean);
  return parts[0] || null;
}

export function isDescendant(parent, child) {
  let current = child;
  while (current) {
    current = current.parent;
    if (current === parent) return true;
  }
  return false;
}
