/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';

import jwt from 'jsonwebtoken';

import { DEFAULT_JWT_CONFIG } from './constants.js';

/**
 * Memoised crypto KeyObjects per (algorithm, secret).
 *
 * jsonwebtoken accepts raw strings but, for every sign/verify call, first
 * tries `createPublicKey()`/`createPrivateKey()` on the string and falls back
 * to `createSecretKey()` when that throws. For HMAC secrets that is an
 * exception per call on the hot path. Handing it a KeyObject skips the probe.
 * The map is tiny (one entry per configured secret) and bounded regardless.
 */
const KEY_CACHE = new Map();
const KEY_CACHE_MAX = 16;

function isHmacAlgorithm(algorithm) {
  return /^HS\d+$/i.test(String(algorithm || ''));
}

/**
 * Resolve the key material jsonwebtoken should use for a secret.
 *
 * @param {string} secret - Configured secret (HMAC secret or PEM)
 * @param {string} algorithm - JWT algorithm (HS256, RS256, ...)
 * @returns {{ sign: import('crypto').KeyObject|string, verify: import('crypto').KeyObject|string }}
 */
export function resolveKeyMaterial(secret, algorithm) {
  const cacheKey = `${algorithm}:${secret}`;
  const cached = KEY_CACHE.get(cacheKey);
  if (cached) return cached;

  // Fall back to the raw string for anything we cannot parse; jsonwebtoken
  // then reports the same error it would have without this optimisation.
  const entry = { sign: secret, verify: secret };

  if (isHmacAlgorithm(algorithm)) {
    try {
      const key = crypto.createSecretKey(Buffer.from(secret, 'utf8'));
      entry.sign = key;
      entry.verify = key;
    } catch {
      // keep raw secret
    }
  } else {
    try {
      entry.sign = crypto.createPrivateKey(secret);
    } catch {
      // verify-only deployments may hold just the public key
    }
    try {
      entry.verify = crypto.createPublicKey(secret);
    } catch {
      // keep raw PEM
    }
  }

  if (KEY_CACHE.size >= KEY_CACHE_MAX) {
    KEY_CACHE.delete(KEY_CACHE.keys().next().value);
  }
  KEY_CACHE.set(cacheKey, entry);
  return entry;
}

/**
 * Generate a JWT token
 *
 * @param {Object} payload - Token payload
 * @param {string} secret - JWT secret
 * @param {Object} [options] - JWT options
 * @returns {string} Generated JWT token
 *
 * @example
 * const token = generateToken(
 *   { userId: 123, email: 'user@example.com' },
 *   process.env.XNAPIFY_KEY
 * );
 */
export function generateToken(payload, secret, options = {}) {
  if (!payload || typeof payload !== 'object') {
    const error = new Error('Payload must be a non-empty object');
    error.name = 'InvalidTokenPayloadError';
    error.status = 400;
    throw error;
  }

  if (typeof secret !== 'string' || secret.trim().length === 0) {
    const error = new Error('Secret must be a non-empty string');
    error.name = 'InvalidTokenSecretError';
    error.status = 400;
    throw error;
  }

  const config = {
    ...DEFAULT_JWT_CONFIG,
    ...options,
  };

  // Add standard claims
  const tokenPayload = {
    ...payload,
    jti: payload.jti || crypto.randomBytes(16).toString('hex'), // JWT ID
    iat: Math.floor(Date.now() / 1000), // Issued at
  };

  return jwt.sign(
    tokenPayload,
    resolveKeyMaterial(secret, config.algorithm).sign,
    {
      algorithm: config.algorithm,
      expiresIn: config.expiresIn,
      issuer: config.issuer,
      audience: config.audience,
    },
  );
}

/**
 * Verify and decode a JWT token
 *
 * @param {string} token - JWT token to verify
 * @param {string} secret - JWT secret
 * @param {Object} [options] - Verification options
 * @returns {Object} Decoded token payload
 *
 * @example
 * try {
 *   const decoded = verifyToken(token, process.env.XNAPIFY_KEY);
 *   console.log('User ID:', decoded.userId);
 * } catch (error) {
 *   console.error('Invalid token:', error.message);
 * }
 */
export function verifyToken(token, secret, options = {}) {
  if (typeof token !== 'string' || token.trim().length === 0) {
    const error = new Error('Token must be a non-empty string');
    error.name = 'InvalidTokenStringError';
    error.status = 400;
    throw error;
  }

  if (typeof secret !== 'string' || secret.trim().length === 0) {
    const error = new Error('Secret must be a non-empty string');
    error.name = 'InvalidTokenSecretError';
    error.status = 400;
    throw error;
  }

  const config = {
    ...DEFAULT_JWT_CONFIG,
    ...options,
  };

  try {
    return jwt.verify(
      token,
      resolveKeyMaterial(secret, config.algorithm).verify,
      {
        algorithms: [config.algorithm],
        issuer: config.issuer,
        audience: config.audience,
      },
    );
  } catch (error) {
    // Enhance error messages
    if (error.name === 'TokenExpiredError') {
      const err = new Error('Token has expired');
      err.name = 'TokenExpiredError';
      err.status = 401;
      throw err;
    }
    if (error.name === 'JsonWebTokenError') {
      const err = new Error('Invalid token format');
      err.name = 'InvalidTokenFormatError';
      err.status = 401;
      throw err;
    }
    if (error.name === 'NotBeforeError') {
      const err = new Error('Token not active yet');
      err.name = 'TokenNotActiveError';
      err.status = 401;
      throw err;
    }
    throw error;
  }
}

/**
 * Decode JWT token without verification (for debugging)
 *
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded token (header and payload)
 *
 * @example
 * const { header, payload } = decodeToken(token);
 * console.log('Token expires at:', new Date(payload.exp * 1000));
 */
export function decodeToken(token) {
  if (typeof token !== 'string' || token.trim().length === 0) {
    const error = new Error('Token must be a non-empty string');
    error.name = 'InvalidTokenStringError';
    error.status = 400;
    throw error;
  }

  try {
    return jwt.decode(token, { complete: true });
  } catch (error) {
    error.name = 'InvalidTokenFormatError';
    error.status = 401;
    throw error;
  }
}
