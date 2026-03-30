/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { jwtCache, cacheToken } from './cache';
import { validateJwtConfig, getJwtConfig } from './config';
import { DEFAULT_JWT_CONFIG } from './constants';
import { generateToken, verifyToken, decodeToken } from './core';
import {
  generateTypedToken,
  verifyTypedToken,
  generateTokenPair,
  refreshTokenPair,
} from './typed';
import {
  isTokenExpired,
  getTokenExpiration,
  getTokenTimeLeft,
  createTokenBlacklistEntry,
} from './utils';

/**
 * Create a configured JWT instance
 *
 * Factory function that creates a JWT utility object with methods
 * pre-bound to the provided secret and configuration.
 *
 * @param {Object} config - JWT configuration
 * @param {string} config.secret - JWT secret (required)
 * @param {string} [config.expiresIn] - Default expiration time
 * @param {string} [config.algorithm] - JWT algorithm
 * @param {string} [config.issuer] - Token issuer
 * @param {string} [config.audience] - Token audience
 * @returns {Object} JWT utilities with bound secret
 */
export function createJwt(config = {}) {
  const { secret, ...options } = config || {};

  if (!secret) {
    const err = new Error('JWT secret is required');
    err.name = 'InvalidJWTConfigError';
    err.status = 400;
    throw err;
  }

  // Merge with defaults
  const jwtConfig = {
    ...DEFAULT_JWT_CONFIG,
    ...options,
  };

  return Object.freeze({
    // Configuration
    secret,

    /**
     * Generate a JWT token
     */
    generateToken(payload, overrides = {}) {
      return generateToken(payload, secret, { ...jwtConfig, ...overrides });
    },

    /**
     * Verify and decode a JWT token
     */
    verifyToken(token, overrides = {}) {
      return verifyToken(token, secret, { ...jwtConfig, ...overrides });
    },

    /**
     * Generate a typed JWT token (access, refresh, etc.)
     */
    generateTypedToken(type, payload, overrides = {}) {
      return generateTypedToken(type, payload, secret, overrides);
    },

    /**
     * Verify a typed JWT token
     */
    verifyTypedToken(token, expectedType, overrides = {}) {
      return verifyTypedToken(token, expectedType, secret, overrides);
    },

    /**
     * Generate a token pair (access + refresh tokens)
     */
    generateTokenPair(payload, overrides = {}) {
      return generateTokenPair(payload, secret, overrides);
    },

    /**
     * Refresh token pair
     */
    refreshTokenPair(refreshToken, overrides = {}) {
      return refreshTokenPair(refreshToken, secret, overrides);
    },

    // Static utilities (don't need secret)
    decodeToken,
    isTokenExpired,
    getTokenExpiration,
    getTokenTimeLeft,
    createTokenBlacklistEntry,
    validateJwtConfig,
    getJwtConfig,

    /**
     * Get JWT cache
     */
    get cache() {
      return jwtCache;
    },

    /**
     * Cache a token
     */
    cacheToken,
  });
}

/**
 * Create a JWT instance from environment variables
 *
 * Convenience factory that reads configuration from env vars.
 * Returns null if JWT secret is not configured.
 */
export function createJwtFromEnv() {
  const secret = process.env.XNAPIFY_JWT_SECRET;

  if (!secret) {
    return null;
  }

  return createJwt({
    secret,
    expiresIn: process.env.XNAPIFY_JWT_EXPIRY || DEFAULT_JWT_CONFIG.expiresIn,
    algorithm: process.env.XNAPIFY_JWT_ALG || DEFAULT_JWT_CONFIG.algorithm,
    issuer: process.env.XNAPIFY_JWT_ISS || DEFAULT_JWT_CONFIG.issuer,
    audience: process.env.XNAPIFY_JWT_AUD || DEFAULT_JWT_CONFIG.audience,
  });
}

/**
 * Configure JWT on Express app and return the instance
 *
 * Helper function to set JWT configuration on an Express app instance.
 *
 * @returns {Object|null} Configured JWT instance or null if secret not found
 */
export function configureJwt() {
  const jwt = createJwtFromEnv();

  if (!jwt) {
    return null;
  }

  return jwt;
}
