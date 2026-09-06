/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { JWT_TOKEN_TYPES } from './constants.js';
import { generateToken, verifyToken } from './core.js';

/**
 * Generate a typed JWT token (access, refresh, etc.)
 *
 * @param {string} type - Token type ('access', 'refresh', 'reset', 'verification')
 * @param {Object} payload - Token payload
 * @param {string} secret - JWT secret
 * @param {Object} [options] - Additional options
 * @returns {string} Generated typed token
 *
 * @example
 * const accessToken = generateTypedToken('access', { userId: 123 }, secret);
 * const refreshToken = generateTypedToken('refresh', { userId: 123 }, secret);
 */
export function generateTypedToken(type, payload, secret, options = {}) {
  const tokenConfig = JWT_TOKEN_TYPES[type];
  if (!tokenConfig) {
    const error = new Error(`Unknown token type: ${type}`);
    error.name = 'UnknownTokenTypeError';
    error.status = 400;
    throw error;
  }

  const enhancedPayload = {
    ...payload,
    type: tokenConfig.type,
  };

  const tokenOptions = {
    expiresIn: tokenConfig.expiresIn,
    ...options,
  };

  return generateToken(enhancedPayload, secret, tokenOptions);
}

/**
 * Verify a typed JWT token
 *
 * @param {string} token - JWT token to verify
 * @param {string} expectedType - Expected token type
 * @param {string} secret - JWT secret
 * @param {Object} [options] - Verification options
 * @returns {Object} Decoded token payload
 *
 * @example
 * const decoded = verifyTypedToken(token, 'access', secret);
 */
export function verifyTypedToken(token, expectedType, secret, options = {}) {
  const decoded = verifyToken(token, secret, options);

  const tokenConfig = JWT_TOKEN_TYPES[expectedType];
  if (!tokenConfig) {
    const error = new Error(`Unknown token type: ${expectedType}`);
    error.name = 'UnknownTokenTypeError';
    error.status = 400;
    throw error;
  }

  if (decoded.type !== tokenConfig.type) {
    const error = new Error(
      `Invalid token type. Expected: ${tokenConfig.type}, got: ${decoded.type}`,
    );
    error.name = 'InvalidTokenTypeError';
    error.status = 401;
    throw error;
  }

  return decoded;
}
