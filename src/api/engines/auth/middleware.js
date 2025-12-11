/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  clearAllAuthCookies,
  getTokenFromCookie,
  getRefreshTokenFromCookie,
  setTokenCookie,
  setRefreshTokenCookie,
} from './cookies';

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
  } = options || {};

  return async (req, res, next) => {
    try {
      const token = extractToken(req, { sources });
      if (!token) {
        const error = new Error('Authentication token required');
        error.status = 401;
        error.code = 'TOKEN_REQUIRED';
        throw error;
      }

      if (includeUser) {
        const jwt = req.app.get('jwt');
        const decoded = jwt.verifyTypedToken(token, tokenType);
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

      return res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code,
      });
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
  } = options || {};

  return async (req, res, next) => {
    try {
      const token = extractToken(req, { sources });
      if (!token) {
        return next(); // No token, continue without authentication
      }

      if (includeUser) {
        const jwt = req.app.get('jwt');
        const decoded = jwt.verifyTypedToken(token, tokenType);
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
  } = options || {};

  return async (req, res, next) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return next();
      }

      // Get JWT instance from app
      const jwt = req.app.get('jwt');

      // Check if token is expired or close to expiration
      const isExpired = jwt.isTokenExpired(token);
      const timeLeft = isExpired ? 0 : jwt.getTokenTimeLeft(token);
      const needsRefresh = isExpired || timeLeft < Math.abs(refreshThreshold);

      if (needsRefresh && autoRefresh) {
        // Try to get refresh token
        const existingRefreshToken = getRefreshTokenFromCookie(req);

        if (existingRefreshToken) {
          try {
            const newTokens = jwt.refreshTokenPair(existingRefreshToken);

            // Set new tokens
            setTokenCookie(res, newTokens.accessToken);
            setRefreshTokenCookie(res, newTokens.refreshToken);

            req.token = newTokens.accessToken;
            req.tokenRefreshed = true;

            if (typeof onRefresh === 'function') {
              onRefresh(req, res, newTokens);
            }

            return next();
          } catch (refreshError) {
            // Refresh failed - clear expired cookies and continue
            // (requireAuth will block protected routes, this middleware is non-blocking)
            if (isExpired) {
              clearAllAuthCookies(res);
              req.tokenCleared = true;
            }
            req.refreshFailed = true;
          }
        } else if (isExpired) {
          // No refresh token and access token expired - clear cookies
          clearAllAuthCookies(res);
          req.tokenCleared = true;
        }
      }

      // Mark that token needs refresh (for client-side handling)
      if (needsRefresh && !req.tokenRefreshed) {
        req.tokenNeedsRefresh = true;
      }

      next();
    } catch (error) {
      // Non-blocking - log error but continue
      req.tokenError = error.message;
      next();
    }
  };
}
