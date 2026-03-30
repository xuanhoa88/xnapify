/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { JWT_TOKEN_TYPES } from './constants';
import { generateToken, verifyToken } from './core';

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
 * Generate a token pair (access + refresh tokens)
 *
 * @param {Object} payload - Token payload (user data)
 * @param {string} secret - JWT secret
 * @param {Object} [options] - Additional options
 * @returns {Object} Token pair with accessToken, refreshToken, and expiresIn
 */
export function generateTokenPair(payload, secret, options = {}) {
  const accessToken = generateTypedToken('access', payload, secret, options);
  const refreshToken = generateTypedToken('refresh', payload, secret, options);

  return { accessToken, refreshToken };
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

/**
 * Refresh token pair (access + refresh)
 *
 * @param {string} refreshToken - Valid refresh token
 * @param {string} secret - JWT secret
 * @param {Object} [options] - Refresh options
 * @returns {Object} New token pair
 *
 * @example
 * try {
 *   const { accessToken, refreshToken: newRefreshToken } =
 *     refreshTokenPair(oldRefreshToken, secret);
 * } catch (error) {
 *   // Refresh token invalid, redirect to login
 * }
 */
export function refreshTokenPair(refreshToken, secret, options = {}) {
  // Verify refresh token
  const decoded = verifyTypedToken(refreshToken, 'refresh', secret);

  // Extract user payload (remove JWT-specific claims)
  const {
    iat: _iat,
    exp: _exp,
    jti: _jti,
    type: _type,
    aud: _aud,
    iss: _iss,
    ...userPayload
  } = decoded;

  // Generate new token pair
  const newAccessToken = generateTypedToken(
    'access',
    userPayload,
    secret,
    options,
  );
  const newRefreshToken = generateTypedToken(
    'refresh',
    userPayload,
    secret,
    options,
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}
