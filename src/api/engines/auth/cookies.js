/**
 * Cookie and Session Utilities
 *
 * Simplified and robust cookie management for authentication.
 * Provides a unified interface for all cookie operations.
 */

import crypto from 'crypto';

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
 * Predefined cookie types with their configurations
 */
const COOKIE_TYPES = Object.freeze({
  jwt: {
    name: 'id_token',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  refresh: {
    name: 'refresh_token',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  session: {
    name: 'session_id',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});

/**
 * Set a secure cookie with unified configuration
 *
 * @param {Object} res - Express response object
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {Object} [options] - Cookie options
 */
export function setSecureCookie(res, name, value, options = {}) {
  const config = {
    ...DEFAULT_COOKIE_CONFIG,
    ...options,
  };

  const cookieOptions = {
    maxAge: config.maxAge,
    httpOnly: config.httpOnly,
    secure: config.secure,
    sameSite: config.sameSite,
    path: config.path,
  };

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
export function clearSecureCookie(res, name, options = {}) {
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
export function getCookieValue(req, name) {
  return (req.cookies && req.cookies[name]) || null;
}

/**
 * Check if cookie exists and has value
 *
 * @param {Object} req - Express request object
 * @param {string} name - Cookie name
 * @returns {boolean} True if cookie exists with value
 */
export function hasCookie(req, name) {
  const value = getCookieValue(req, name);
  return value != null && value !== '';
}

/**
 * Unified cookie management function
 *
 * @param {string} action - Action to perform ('set', 'get', 'clear', 'has')
 * @param {string} type - Cookie type ('jwt', 'refresh', 'session', or custom name)
 * @param {Object} context - Request/Response context
 * @param {string} [value] - Value to set (for 'set' action)
 * @param {Object} [options] - Additional options
 * @returns {string|boolean|void} Result based on action
 */
export function manageCookie(
  action,
  type,
  context,
  value = null,
  options = {},
) {
  // Determine cookie configuration
  const cookieConfig = COOKIE_TYPES[type] || { name: type };
  const config = { ...cookieConfig, ...options };

  switch (action) {
    case 'set':
      if (!context.res || !value) {
        throw new Error('Response object and value required for set action');
      }
      return setSecureCookie(context.res, config.name, value, {
        maxAge: config.maxAge,
        domain: config.domain,
        path: config.path,
      });

    case 'get':
      if (!context.req) {
        throw new Error('Request object required for get action');
      }
      return getCookieValue(context.req, config.name);

    case 'clear':
      if (!context.res) {
        throw new Error('Response object required for clear action');
      }
      return clearSecureCookie(context.res, config.name, {
        path: config.path,
        domain: config.domain,
      });

    case 'has':
      if (!context.req) {
        throw new Error('Request object required for has action');
      }
      return hasCookie(context.req, config.name);

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Generate a cryptographically secure session ID
 */
export function generateSessionId(length = 32) {
  return crypto.randomBytes(length).toString('hex');
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
 * Clear refresh token cookie
 */
export function clearRefreshTokenCookie(res, options = {}) {
  return manageCookie('clear', 'refresh', { res }, null, options);
}

/**
 * Create session with cookie
 */
export function createSession(res, sessionData, options = {}) {
  const sessionId = generateSessionId();

  // In production, store sessionData in database/cache with sessionId
  // For now, we just set the session cookie

  manageCookie('set', 'session', { res }, sessionId, options);
  return sessionId;
}

/**
 * Get session ID from cookie
 */
export function getSessionId(req, options = {}) {
  return manageCookie('get', 'session', { req }, null, options);
}

/**
 * Destroy session
 */
export function destroySession(res, sessionId, options = {}) {
  // In production, remove sessionData from database/cache
  return manageCookie('clear', 'session', { res }, null, options);
}

/**
 * Clear all authentication cookies
 */
export function clearAllAuthCookies(res, options = {}) {
  const cookieNames = options.cookieNames || [
    'id_token',
    'refresh_token',
    'session_id',
  ];

  cookieNames.forEach(name => {
    clearSecureCookie(res, name, {
      path: options.path || DEFAULT_COOKIE_CONFIG.path,
      domain: options.domain,
    });
  });
}

/**
 * Get cookie configuration for a type
 */
export function getCookieConfig(type = 'jwt', overrides = {}) {
  const baseConfig = COOKIE_TYPES[type] || { name: type };
  return {
    ...baseConfig,
    ...DEFAULT_COOKIE_CONFIG,
    ...overrides,
  };
}

/**
 * Validate cookie options
 */
export function validateCookieOptions(options = {}) {
  const errors = [];

  if (
    options.name &&
    (typeof options.name !== 'string' || options.name.trim().length === 0)
  ) {
    errors.push('Cookie name must be a string');
  }

  if (
    options.maxAge &&
    (typeof options.maxAge !== 'number' || options.maxAge < 0)
  ) {
    errors.push('Cookie maxAge must be a positive number');
  }

  if (
    options.sameSite &&
    !['strict', 'lax', 'none'].includes(options.sameSite.toLowerCase())
  ) {
    errors.push('Cookie sameSite must be "strict", "lax", or "none"');
  }

  if (
    options.path &&
    (typeof options.path !== 'string' || options.path.trim().length === 0)
  ) {
    errors.push('Cookie path must be a string');
  }

  if (
    options.domain &&
    (typeof options.domain !== 'string' || options.domain.trim().length === 0)
  ) {
    errors.push('Cookie domain must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
