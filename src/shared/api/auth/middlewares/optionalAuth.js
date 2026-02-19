/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { extractToken } from '../cookies';

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
        const decodedToken = jwt.decodeToken(token);

        if (decodedToken && decodedToken.payload) {
          const { payload } = decodedToken;
          const strategyKey =
            payload && payload.type ? `auth.strategy.${payload.type}` : null;
          const hook = req.app.get('hook');
          if (strategyKey && hook.has(strategyKey)) {
            // Delegate to registered strategy (event-based)
            await hook(strategyKey).emit('authenticate', req, {
              jwt,
              token,
              payload,
            });
          } else {
            // Standard User Token flow (fallback)
            const decoded = jwt.verifyTypedToken(token, tokenType);
            req.user = decoded;
            req.authMethod = 'jwt';
          }
        }
      }

      if (!req.authMethod) {
        req.authMethod = 'jwt';
      }
      req.token = token;
      req.authenticated = true;

      next();
    } catch (error) {
      req.authenticated = false;
      next();
    }
  };
}
