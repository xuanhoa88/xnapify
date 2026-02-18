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
export function requireAuthMiddleware(options = {}) {
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
        error.name = 'TokenRequiredError';
        error.status = 401;
        error.code = 'TOKEN_REQUIRED';
        throw error;
      }

      req.token = token;
      // Default fallback; updated if verification succeeds
      req.authMethod = 'token';

      if (includeUser) {
        const jwt = req.app.get('jwt');

        // Decode without verifying first to check type
        // This avoids double verification for standard tokens
        const decodedToken = jwt.decodeToken(token);

        if (!decodedToken || !decodedToken.payload) {
          const error = new Error('Invalid token format');
          error.name = 'InvalidTokenFormatError';
          error.status = 401;
          throw error;
        }

        const { payload } = decodedToken;
        const strategyKey =
          payload && payload.type ? `auth.strategy.${payload.type}` : null;
        const strategy = strategyKey ? req.app.get(strategyKey) : null;

        if (typeof strategy === 'function') {
          // Delegate to registered strategy
          const result = await strategy(req, token, payload, { jwt });
          Object.assign(req, result);
        } else {
          // Standard User Token flow (fallback)
          // Verify typed token (checks signature + type === tokenType)
          // Only ONE verification call
          const verified = jwt.verifyTypedToken(token, tokenType);
          req.user = verified;
          req.authMethod = 'jwt';
        }

        // Only set authenticated if we successfully verified
        req.authenticated = true;
      }

      next();
    } catch (error) {
      // Only set status if not already set (preserve 500s)
      if (!error.status) {
        error.status = 401;
      }

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
export function optionalAuthMiddleware(options = {}) {
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
 * Automatically refreshes access tokens when they are expired or close to expiration.
 * Uses a "safe" approach - only clears cookies when refresh token is explicitly invalid,
 * not for transient errors (network issues, temporary server errors).
 *
 * @param {Object} [options] - Refresh options
 * @returns {Function} Express middleware
 */
export function refreshTokenMiddleware(options = {}) {
  const {
    refreshThreshold = 5 * 60, // 5 minutes in seconds
    autoRefresh = true,
    onRefresh,
  } = options || {};

  // Error codes that indicate the refresh token is truly invalid (not retryable)
  const INVALID_TOKEN_ERRORS = new Set([
    'TokenExpiredError',
    'InvalidTokenTypeError',
    'InvalidTokenFormatError',
    'JsonWebTokenError',
  ]);

  return async (req, res, next) => {
    try {
      const token = extractToken(req);
      if (!token) {
        // No token - set header to indicate guest state
        res.setHeader('X-Auth-Status', 'guest');
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

            // Signal successful refresh to client
            res.setHeader('X-Auth-Status', 'refreshed');
            res.setHeader('X-Token-Refreshed', 'true');

            if (typeof onRefresh === 'function') {
              onRefresh(req, res, newTokens);
            }

            return next();
          } catch (refreshError) {
            // Only clear cookies if refresh token is EXPLICITLY invalid
            // Don't clear for transient errors (network, temporary failures)
            const isTokenInvalid = INVALID_TOKEN_ERRORS.has(refreshError.name);

            if (isTokenInvalid) {
              // Refresh token is truly invalid - clear cookies
              clearAllAuthCookies(res);
              req.tokenCleared = true;
              res.setHeader('X-Auth-Status', 'expired');
            } else {
              // Transient error - keep cookies, let client retry
              req.refreshFailed = true;
              req.refreshError = refreshError.message;
              res.setHeader('X-Auth-Status', 'refresh-failed');
            }
          }
        } else if (isExpired) {
          // No refresh token and access token expired
          // Don't clear cookies immediately - let client try to recover
          // Only mark as needing refresh
          req.tokenNeedsRefresh = true;
          res.setHeader('X-Auth-Status', 'needs-refresh');
        }
      } else {
        // Token is valid and doesn't need refresh
        res.setHeader('X-Auth-Status', 'valid');
      }

      // Mark that token needs refresh (for client-side handling)
      if (needsRefresh && !req.tokenRefreshed) {
        req.tokenNeedsRefresh = true;
      }

      next();
    } catch (error) {
      // Non-blocking - log error but continue
      // Don't clear cookies for unexpected errors
      req.tokenError = error.message;
      res.setHeader('X-Auth-Status', 'error');
      next();
    }
  };
}
