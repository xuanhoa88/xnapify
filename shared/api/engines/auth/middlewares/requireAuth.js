/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { extractToken } from '../cookies';

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
        error.name = 'TokenRequiredError';
        error.status = 401;
        error.code = 'TOKEN_REQUIRED';
        throw error;
      }

      req.token = token;
      // Default fallback; updated if verification succeeds
      req.authMethod = 'token';

      if (includeUser) {
        const container = req.app.get('container');
        const jwt = container.resolve('jwt');

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
        const hook = container.resolve('hook');
        if (strategyKey && hook.has(strategyKey)) {
          // Delegate to registered strategy (event-based)
          await hook(strategyKey).invoke('authenticate', req, {
            jwt,
            token,
            payload,
          });
        } else {
          // Standard User Token flow (fallback)
          // First consult cache to avoid redundant crypto work.
          const cachedUser = jwt.cache.get(token);
          if (cachedUser) {
            req.user = cachedUser;
          } else {
            // Verify typed token (checks signature + type === tokenType)
            const decoded = jwt.verifyTypedToken(token, tokenType);
            req.user = decoded;
            jwt.cacheToken(token, decoded);
          }
          req.authMethod = 'jwt';
        }

        // Set authenticated for all successful verifications
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
