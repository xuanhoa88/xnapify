/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Default JWT configuration
 */
export const DEFAULT_JWT_CONFIG = Object.freeze({
  algorithm: 'HS256',
  expiresIn: '7d',
  issuer: 'xnapify',
  audience: 'xnapify-users',
});

/**
 * JWT token types with different configurations
 */
export const JWT_TOKEN_TYPES = Object.freeze({
  access: {
    expiresIn: '15m',
    type: 'access_token',
  },
  refresh: {
    expiresIn: '30d',
    type: 'refresh_token',
  },
  reset: {
    expiresIn: '1h',
    type: 'reset_token',
  },
  verification: {
    expiresIn: '24h',
    type: 'verification_token',
  },
});
