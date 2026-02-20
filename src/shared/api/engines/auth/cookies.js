/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Default cookie configuration
 */
export const DEFAULT_COOKIE_CONFIG = Object.freeze({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
});

/**
 * Cookie names
 */
const JWT_COOKIE_NAME = process.env.RSK_JWT_COOKIE_NAME || 'id_token';
const REFRESH_COOKIE_NAME =
  process.env.RSK_REFRESH_COOKIE_NAME || 'refresh_token';

/**
 * Predefined cookie types with their configurations
 */
const COOKIE_TYPES = Object.freeze({
  jwt: {
    name: JWT_COOKIE_NAME,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  refresh: {
    name: REFRESH_COOKIE_NAME,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
});

/**
 * Set a secure cookie with unified configuration
 *
 * @param {Object} res - Express response object
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {Object} [options] - Cookie options
 * @param {number} [options.maxAge] - Max age in ms (undefined = session cookie)
 */
function setSecureCookie(res, name, value, options = {}) {
  const config = {
    ...DEFAULT_COOKIE_CONFIG,
    ...options,
  };

  const cookieOptions = {
    httpOnly: config.httpOnly,
    secure: config.secure,
    sameSite: config.sameSite,
    path: config.path,
  };

  // Only set maxAge if provided (undefined = session cookie, expires on browser close)
  if (config.maxAge != null) {
    cookieOptions.maxAge = config.maxAge;
  }

  if (config.domain) {
    cookieOptions.domain = config.domain;
  }

  res.cookie(name, value, cookieOptions);
}

/**
 * Clear a cookie
 *
 * @param {Object} res - Express response object
 * @param {string} name - Cookie name
 * @param {Object} [options] - Cookie options
 */
function clearSecureCookie(res, name, options = {}) {
  const config = {
    path: DEFAULT_COOKIE_CONFIG.path,
    ...options,
  };

  const clearOptions = {
    path: config.path,
  };

  if (config.domain) {
    clearOptions.domain = config.domain;
  }

  res.clearCookie(name, clearOptions);
}

/**
 * Get cookie value from request
 *
 * @param {Object} req - Express request object
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value or null if not found
 */
function getCookieValue(req, name) {
  return (req.cookies && req.cookies[name]) || null;
}

/**
 * Check if cookie exists and has value
 *
 * @param {Object} req - Express request object
 * @param {string} name - Cookie name
 * @returns {boolean} True if cookie exists with value
 */
function hasCookie(req, name) {
  const value = getCookieValue(req, name);
  return value != null && value !== '';
}

/**
 * Unified cookie management function
 *
 * @param {string} action - Action to perform ('set', 'get', 'clear', 'has')
 * @param {string} type - Cookie type ('jwt', 'refresh', or custom name)
 * @param {Object} context - Request/Response context
 * @param {string} [value] - Value to set (for 'set' action)
 * @param {Object} [options] - Additional options
 * @returns {string|boolean|void} Result based on action
 */
function manageCookie(action, type, context = {}, value = null, options = {}) {
  // Validate required parameters
  if (typeof action !== 'string' || action.trim().length === 0) {
    const error = new Error('Action must be a non-empty string');
    error.name = 'InvalidParameterError';
    error.status = 400;
    throw error;
  }

  if (typeof type !== 'string' || type.trim().length === 0) {
    const error = new Error('Type must be a non-empty string');
    error.name = 'InvalidParameterError';
    error.status = 400;
    throw error;
  }

  // Determine cookie configuration
  const cookieConfig = COOKIE_TYPES[type] || { name: type };
  const config = { ...cookieConfig, ...options };

  switch (action) {
    case 'set':
      if (!context.res) {
        const error = new Error('Response object required for set action');
        error.name = 'MissingResponseError';
        error.status = 400;
        throw error;
      }
      if (!value) {
        const error = new Error('Value required for set action');
        error.name = 'MissingCookieValueError';
        error.status = 400;
        throw error;
      }
      return setSecureCookie(context.res, config.name, value, {
        maxAge: config.maxAge,
        domain: config.domain,
        path: config.path,
      });

    case 'get':
      if (!context.req) {
        const error = new Error('Request object required for get action');
        error.name = 'MissingRequestError';
        error.status = 400;
        throw error;
      }
      return getCookieValue(context.req, config.name);

    case 'clear':
      if (!context.res) {
        const error = new Error('Response object required for clear action');
        error.name = 'MissingResponseError';
        error.status = 400;
        throw error;
      }
      return clearSecureCookie(context.res, config.name, {
        path: config.path,
        domain: config.domain,
      });

    case 'has':
      if (!context.req) {
        const error = new Error('Request object required for has action');
        error.name = 'MissingRequestError';
        error.status = 400;
        throw error;
      }
      return hasCookie(context.req, config.name);

    default: {
      const error = new Error(`Unknown action: ${action}`);
      error.name = 'UnknownCookieActionError';
      error.status = 400;
      throw error;
    }
  }
}

/**
 * Set JWT token cookie
 */
export function setTokenCookie(res, token, options = {}) {
  return manageCookie('set', 'jwt', { res }, token, options);
}

/**
 * Get JWT token from cookie
 */
export function getTokenFromCookie(req, options = {}) {
  return manageCookie('get', 'jwt', { req }, null, options);
}

/**
 * Check if JWT token cookie exists
 */
export function hasTokenCookie(req, options = {}) {
  return manageCookie('has', 'jwt', { req }, null, options);
}

/**
 * Clear JWT token cookie
 */
export function clearTokenCookie(res, options = {}) {
  return manageCookie('clear', 'jwt', { res }, null, options);
}

/**
 * Set refresh token cookie
 */
export function setRefreshTokenCookie(res, refreshToken, options = {}) {
  return manageCookie('set', 'refresh', { res }, refreshToken, options);
}

/**
 * Check if refresh token cookie exists
 */
export function hasRefreshTokenCookie(req, options = {}) {
  return manageCookie('has', 'refresh', { req }, null, options);
}

/**
 * Get refresh token from cookie
 */
export function getRefreshTokenFromCookie(req, options = {}) {
  return manageCookie('get', 'refresh', { req }, null, options);
}

/**
 * Clear refresh token cookie
 */
export function clearRefreshTokenCookie(res, options = {}) {
  return manageCookie('clear', 'refresh', { res }, null, options);
}

/**
 * Clear all authentication cookies
 */
export function clearAllAuthCookies(res, options = {}) {
  // Validate required parameters
  if (!res) {
    const error = new Error('Response object required for clearAllAuthCookies');
    error.name = 'MissingResponseError';
    error.status = 400;
    throw error;
  }

  // Default to JWT and refresh cookies if none provided
  const cookieNames =
    options && Array.isArray(options.cookieNames)
      ? options.cookieNames
      : [JWT_COOKIE_NAME, REFRESH_COOKIE_NAME];

  // Clear each cookie
  cookieNames.forEach(name =>
    clearSecureCookie(res, name, {
      path: options.path || DEFAULT_COOKIE_CONFIG.path,
      domain: options.domain,
    }),
  );
}

/**
 * Extract token from various sources
 *
 * @param {Object} req - Express request object
 * @param {Object} [options] - Extraction options
 * @returns {string|null} Extracted token or null
 */
export function extractToken(req, options = {}) {
  const {
    sources = ['cookie', 'header', 'query'],
    headerName = 'authorization',
    headerPrefix = 'Bearer ',
    queryParam = 'token',
  } = options || {};

  for (const source of sources) {
    let token = null;

    switch (source) {
      case 'cookie': {
        token = getTokenFromCookie(req);
        break;
      }

      case 'header': {
        const authHeader = req.headers[headerName.toLowerCase()];
        if (authHeader && authHeader.startsWith(headerPrefix)) {
          token = authHeader.slice(headerPrefix.length);
        }
        break;
      }

      case 'query': {
        token = req.query[queryParam];
        break;
      }
    }

    if (token) {
      return token;
    }
  }

  return null;
}
