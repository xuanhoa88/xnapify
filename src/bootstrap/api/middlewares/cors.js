/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import cors from 'cors';

/**
 * Create CORS middleware
 *
 * @returns {Function} CORS middleware
 */
export function createCorsMiddleware() {
  // Parse environment variable as comma-separated array with fallback
  const parseEnvArray = (envValue, defaultValue = []) => {
    return typeof envValue === 'string'
      ? envValue
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      : defaultValue;
  };

  return function corsWithReq(req, res, next) {
    cors({
      origin(origin, callback) {
        const corsOrigin =
          typeof process.env.XNAPIFY_CORS_ORIGIN === 'string'
            ? process.env.XNAPIFY_CORS_ORIGIN.trim()
            : '';

        // Handle boolean string values
        if (corsOrigin === 'true') {
          // Allow all origins (WARNING: use only in development)
          return callback(null, true);
        }

        if (corsOrigin === 'false') {
          // Block all origins
          return callback(null, false);
        }

        // Allow requests with no origin (like mobile apps, curl, Postman)
        // Remove this if you want to block requests without origin
        if (!origin) {
          return callback(null, true);
        }

        // Parse allowed origins from environment variable
        const allowedOrigins = parseEnvArray(corsOrigin, []);

        // If no origins configured, block by default (secure default)
        if (allowedOrigins.length === 0) {
          // For SSR apps, you typically want to allow your own domain
          // Check if the request is from the same host
          const reqHost = req.headers.host || req.headers.origin;
          let originHost = null;

          try {
            originHost = new URL(origin).host;
          } catch {
            return callback(null, false);
          }

          if (originHost === reqHost) {
            return callback(null, true);
          }

          return callback(null, false);
        }

        // Check if origin matches any allowed pattern
        const isAllowed = allowedOrigins.some(allowedOrigin => {
          // Exact match
          if (allowedOrigin === origin) {
            return true;
          }

          // Wildcard support (e.g., "https://*.example.com")
          if (allowedOrigin.includes('*')) {
            // Escape special regex characters except *
            const escapedPattern = allowedOrigin
              .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
              .replace(/\*/g, '.*');
            return new RegExp(`^${escapedPattern}$`).test(origin);
          }

          return false;
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`), false);
        }
      },

      // Recommended additional CORS settings
      credentials: true, // Allow cookies/auth headers
      maxAge: 86400, // Cache preflight requests for 24 hours,
    })(req, res, next);
  };
}
