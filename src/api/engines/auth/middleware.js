/**
 * Authentication Middleware
 *
 * Comprehensive authentication middleware collection using the auth engine utilities.
 * Provides ready-to-use middleware for various authentication scenarios.
 */

import { manageCookie } from './cookies';
import {
  verifyTypedToken,
  isTokenExpired,
  refreshTokenPair,
  getTokenTimeLeft,
} from './jwt';

/**
 * Extract token from various sources
 *
 * @param {Object} req - Express request object
 * @param {Object} [options] - Extraction options
 * @returns {string|null} Extracted token or null
 */
function extractToken(req, options = {}) {
  const {
    sources = ['cookie', 'header', 'query'],
    headerName = 'authorization',
    headerPrefix = 'Bearer ',
    queryParam = 'token',
  } = options;

  for (const source of sources) {
    let token = null;

    switch (source) {
      case 'cookie':
        token = manageCookie('get', 'jwt', { req });
        break;

      case 'header': {
        const authHeader = req.headers[headerName.toLowerCase()];
        if (authHeader && authHeader.startsWith(headerPrefix)) {
          token = authHeader.slice(headerPrefix.length);
        }
        break;
      }

      case 'query':
        token = req.query[queryParam];
        break;
    }

    if (token) {
      return token;
    }
  }

  return null;
}

/**
 * Send standardized error response
 *
 * @param {Object} res - Express response object
 * @param {Error} error - Error object with status and code properties
 * @returns {Object} JSON response
 */
function sendErrorResponse(res, error) {
  return res.status(error.status || 500).json({
    success: false,
    error: error.message,
    code: error.code,
  });
}

/**
 * Basic JWT authentication middleware
 *
 * @param {Object} [options] - Middleware options
 * @returns {Function} Express middleware
 */
export function requireAuth(options = {}) {
  const {
    tokenType = 'access',
    sources = ['cookie', 'header'],
    onError,
    includeUser = true,
    jwtSecret,
  } = options;

  return async (req, res, next) => {
    try {
      const token = extractToken(req, { sources });

      if (!token) {
        const error = new Error('Authentication token required');
        error.status = 401;
        error.code = 'TOKEN_REQUIRED';
        throw error;
      }

      const decoded = verifyTypedToken(token, tokenType, jwtSecret);

      if (includeUser) {
        req.user = decoded;
      }
      req.token = token;
      req.authMethod = 'jwt';
      req.authenticated = true;

      next();
    } catch (error) {
      error.status = 401;

      // Determine error code based on error type
      if (!error.code) {
        if (error.name === 'TokenExpiredError') {
          error.code = 'TOKEN_EXPIRED';
        } else {
          error.code = 'TOKEN_INVALID';
        }
      }

      if (typeof onError === 'function') {
        return onError(error, req, res, next);
      }

      return sendErrorResponse(res, error);
    }
  };
}

/**
 * Optional JWT authentication middleware
 *
 * @param {Object} [options] - Middleware options
 * @returns {Function} Express middleware
 */
export function optionalAuth(options = {}) {
  const {
    tokenType = 'access',
    sources = ['cookie', 'header'],
    includeUser = true,
    jwtSecret,
  } = options;

  return async (req, res, next) => {
    try {
      const token = extractToken(req, { sources });

      if (!token) {
        return next(); // No token, continue without authentication
      }

      const decoded = verifyTypedToken(token, tokenType, jwtSecret);

      if (includeUser) {
        req.user = decoded;
      }
      req.token = token;
      req.authMethod = 'jwt';
      req.authenticated = true;

      next();
    } catch (error) {
      req.authenticated = false;
      next();
    }
  };
}

/**
 * Token refresh middleware
 *
 * @param {Object} [options] - Refresh options
 * @returns {Function} Express middleware
 */
export function refreshToken(options = {}) {
  const {
    refreshThreshold = 5 * 60, // 5 minutes in seconds
    autoRefresh = true,
    onRefresh,
    jwtSecret,
  } = options;

  return async (req, res, next) => {
    try {
      const token = extractToken(req);

      if (!token) {
        return next();
      }

      // Check if token needs refresh
      if (isTokenExpired(token)) {
        const error = new Error('Token has expired');
        error.status = 401;
        error.code = 'TOKEN_EXPIRED';
        throw error;
      }

      // Check if token is close to expiration
      const timeLeft = getTokenTimeLeft(token);

      if (timeLeft < refreshThreshold) {
        req.tokenNeedsRefresh = true;

        if (autoRefresh) {
          // Try to get refresh token
          const refreshToken = manageCookie('get', 'refresh', { req });

          if (refreshToken) {
            try {
              const newTokens = refreshTokenPair(refreshToken, jwtSecret);

              // Set new tokens
              manageCookie('set', 'jwt', { res }, newTokens.accessToken);
              manageCookie('set', 'refresh', { res }, newTokens.refreshToken);

              req.token = newTokens.accessToken;
              req.tokenRefreshed = true;

              if (onRefresh) {
                onRefresh(req, res, newTokens);
              }
            } catch (refreshError) {
              // Refresh failed, let the request continue with existing token
              req.refreshFailed = true;
            }
          }
        }
      }

      next();
    } catch (error) {
      error.status = error.status || 401;
      error.code = error.code || 'TOKEN_REFRESH_ERROR';
      return sendErrorResponse(res, error);
    }
  };
}

/**
 * Session-based authentication middleware
 *
 * @param {Object} [options] - Session options
 * @returns {Function} Express middleware
 */
export function requireSession(options = {}) {
  const {
    sessionStore, // Function to get session data by ID
    onError,
  } = options;

  return async (req, res, next) => {
    try {
      const sessionId = manageCookie('get', 'session', { req });

      if (!sessionId) {
        const error = new Error('Session required');
        error.status = 401;
        error.code = 'SESSION_REQUIRED';
        throw error;
      }

      // Get session data from store (if provided)
      if (sessionStore) {
        const sessionData = await sessionStore(sessionId);
        if (!sessionData) {
          const error = new Error('Invalid session');
          error.status = 401;
          error.code = 'INVALID_SESSION';
          throw error;
        }

        req.session = sessionData;
      }

      req.sessionId = sessionId;
      req.authMethod = 'session';
      req.authenticated = true;

      next();
    } catch (error) {
      error.status = error.status || 500;
      error.code = error.code || 'SESSION_ERROR';

      if (typeof onError === 'function') {
        return onError(error, req, res, next);
      }

      return sendErrorResponse(res, error);
    }
  };
}

/**
 * Optional session-based authentication middleware
 *
 * Attempts to authenticate via session but allows request to proceed
 * even if no session exists or session is invalid.
 *
 * Sets the following properties on req:
 * - req.session: Session data (if valid session exists)
 * - req.sessionId: Session ID (if exists)
 * - req.authMethod: 'session' (if authenticated)
 * - req.authenticated: true/false
 *
 * @param {Object} [options] - Session options
 * @param {Function} [options.sessionStore] - Function to get session data by ID
 * @returns {Function} Express middleware
 */
export function optionalSession(options = {}) {
  const { sessionStore } = options;

  return async (req, res, next) => {
    try {
      const sessionId = manageCookie('get', 'session', { req });

      if (!sessionId) {
        req.authenticated = false;
        return next(); // No session, continue without authentication
      }

      // Get session data from store (if provided)
      if (sessionStore) {
        const sessionData = await sessionStore(sessionId);

        if (!sessionData) {
          req.authenticated = false;
          return next(); // Invalid session, continue without authentication
        }

        req.session = sessionData;
      }

      req.sessionId = sessionId;
      req.authMethod = 'session';
      req.authenticated = true;

      next();
    } catch (error) {
      // On any error, continue without authentication
      req.authenticated = false;
      next();
    }
  };
}

/**
 * Combined authentication middleware (tries multiple methods)
 *
 * @param {Object} [options] - Combined auth options
 * @returns {Function} Express middleware
 */
export function requireAnyAuth(options = {}) {
  const {
    methods = ['jwt', 'session'],
    jwtOptions = {},
    sessionOptions = {},
    onError,
    jwtSecret,
  } = options;

  return async (req, res, next) => {
    const errors = [];

    // Try JWT authentication
    if (methods.includes('jwt')) {
      try {
        const token = extractToken(req, jwtOptions.sources);
        if (token) {
          const decoded = verifyTypedToken(
            token,
            jwtOptions.tokenType || 'access',
            jwtSecret,
          );

          req.user = decoded;
          req.token = token;
          req.authMethod = 'jwt';
          return next();
        }
      } catch (error) {
        errors.push({ method: 'jwt', error: error.message });
      }
    }

    // Try session authentication
    if (methods.includes('session')) {
      try {
        const sessionId = manageCookie('get', 'session', { req });
        if (sessionId) {
          if (sessionOptions.sessionStore) {
            const sessionData = await sessionOptions.sessionStore(sessionId);
            if (sessionData) {
              req.session = sessionData;
              req.sessionId = sessionId;
              req.authMethod = 'session';
              return next();
            }
          } else {
            req.sessionId = sessionId;
            req.authMethod = 'session';
            return next();
          }
        }
      } catch (error) {
        errors.push({ method: 'session', error: error.message });
      }
    }

    // No authentication method succeeded
    const error = new Error('Authentication required');
    error.status = 401;
    error.code = 'AUTH_REQUIRED';
    error.attempts = errors;

    if (typeof onError === 'function') {
      return onError(error, req, res, next);
    }

    return res.status(401).json({
      success: false,
      error: error.message,
      code: error.code,
      attempts: errors,
    });
  };
}
