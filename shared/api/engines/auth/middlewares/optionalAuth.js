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

      const jwt = req.app.get('jwt');

      if (includeUser) {
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
            // Standard User Token flow — consult cache first
            const cachedUser = jwt.cache.get(token);
            if (cachedUser) {
              req.user = cachedUser;
            } else {
              const decoded = jwt.verifyTypedToken(token, tokenType);
              req.user = decoded;
              jwt.cacheToken(token, decoded);
            }
            req.authMethod = 'jwt';
          }
        }
      } else {
        // Even without user resolution, verify the token signature
        // to ensure we don't mark forged/expired tokens as authenticated
        if (!jwt.cache.get(token)) {
          const decoded = jwt.verifyTypedToken(token, tokenType);
          jwt.cacheToken(token, decoded);
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
