/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  clearAllAuthCookies,
  getRefreshTokenFromCookie,
  setTokenCookie,
  setRefreshTokenCookie,
  extractToken,
} from '@shared/cookies';

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
export function refreshToken(options = {}) {
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
      const jwt = req.app.get('container').resolve('jwt');

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
