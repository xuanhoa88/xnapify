/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * Default JWT configuration
 */
const DEFAULT_JWT_CONFIG = Object.freeze({
  algorithm: 'HS256',
  expiresIn: '7d',
  issuer: 'rsk',
  audience: 'rsk-users',
});

/**
 * JWT token types with different configurations
 */
const JWT_TOKEN_TYPES = Object.freeze({
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
 *   process.env.JWT_SECRET
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
    jti: crypto.randomBytes(16).toString('hex'), // JWT ID
    iat: Math.floor(Date.now() / 1000), // Issued at
  };

  return jwt.sign(tokenPayload, secret, {
    algorithm: config.algorithm,
    expiresIn: config.expiresIn,
    issuer: config.issuer,
    audience: config.audience,
  });
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
 *   const decoded = verifyToken(token, process.env.JWT_SECRET);
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
    return jwt.verify(token, secret, {
      algorithms: [config.algorithm],
      issuer: config.issuer,
      audience: config.audience,
    });
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

/**
 * Check if JWT token is expired
 *
 * @param {string} token - JWT token to check
 * @returns {boolean} True if token is expired
 *
 * @example
 * if (isTokenExpired(token)) {
 *   console.log('Token needs refresh');
 * }
 */
export function isTokenExpired(token) {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.payload || !decoded.payload.exp) {
      return true; // No expiration claim means invalid
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.payload.exp < currentTime;
  } catch {
    return true; // Invalid token is considered expired
  }
}

/**
 * Get token expiration time
 *
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null if invalid
 *
 * @example
 * const expiresAt = getTokenExpiration(token);
 * console.log('Token expires at:', expiresAt);
 */
export function getTokenExpiration(token) {
  try {
    const decoded = decodeToken(token);
    if (decoded && decoded.payload && decoded.payload.exp) {
      return new Date(decoded.payload.exp * 1000);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get time until token expiration
 *
 * @param {string} token - JWT token
 * @returns {number} Seconds until expiration, or 0 if expired/invalid
 *
 * @example
 * const secondsLeft = getTokenTimeLeft(token);
 * if (secondsLeft < 300) { // Less than 5 minutes
 *   refreshToken();
 * }
 */
export function getTokenTimeLeft(token) {
  try {
    const decoded = decodeToken(token);
    if (decoded && decoded.payload && decoded.payload.exp) {
      const currentTime = Math.floor(Date.now() / 1000);
      const timeLeft = decoded.payload.exp - currentTime;
      return Math.max(0, timeLeft);
    }
    return 0;
  } catch {
    return 0;
  }
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
  // eslint-disable-next-line no-unused-vars
  const { iat, exp, jti, type, ...userPayload } = decoded;

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

/**
 * Create token blacklist entry (for logout)
 *
 * @param {string} token - Token to blacklist
 * @returns {Object} Blacklist entry
 *
 * @example
 * const blacklistEntry = createTokenBlacklistEntry(token);
 * await saveToBlacklist(blacklistEntry);
 */
export function createTokenBlacklistEntry(token) {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.payload) {
      const error = new Error('Invalid token');
      error.name = 'InvalidTokenFormatError';
      error.status = 401;
      throw error;
    }

    return {
      jti: decoded.payload.jti,
      exp: decoded.payload.exp,
      blacklistedAt: Math.floor(Date.now() / 1000),
    };
  } catch (error) {
    error.name = 'InvalidTokenFormatError';
    error.status = 401;
    throw error;
  }
}

/**
 * Validate JWT configuration
 *
 * @param {Object} config - JWT configuration to validate
 * @returns {Object} Validation result
 */
export function validateJwtConfig(config = {}) {
  const errors = [];

  if (
    config.algorithm &&
    !['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'].includes(
      config.algorithm,
    )
  ) {
    errors.push('JWT_INVALID_ALGORITHM');
  }

  if (
    config.expiresIn &&
    typeof config.expiresIn !== 'string' &&
    typeof config.expiresIn !== 'number'
  ) {
    errors.push('JWT_INVALID_EXPIRES_IN');
  }

  if (
    config.issuer &&
    (typeof config.issuer !== 'string' || config.issuer.trim().length === 0)
  ) {
    errors.push('JWT_INVALID_ISSUER');
  }

  if (
    config.audience &&
    (typeof config.audience !== 'string' || config.audience.trim().length === 0)
  ) {
    errors.push('JWT_INVALID_AUDIENCE');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get JWT configuration for token type
 *
 * @param {string} type - Token type
 * @param {Object} [overrides] - Configuration overrides
 * @returns {Object} JWT configuration
 */
export function getJwtConfig(type = 'access', overrides = {}) {
  const tokenConfig = JWT_TOKEN_TYPES[type] || JWT_TOKEN_TYPES.access;

  return Object.freeze({
    ...DEFAULT_JWT_CONFIG,
    ...tokenConfig,
    ...overrides,
  });
}

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
    throw new Error('JWT secret is required');
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
  });
}

/**
 * Create a JWT instance from environment variables
 *
 * Convenience factory that reads configuration from env vars.
 * Returns null if JWT secret is not configured.
 */
export function createJwtFromEnv() {
  const secret = process.env.RSK_JWT_SECRET;

  if (!secret) {
    return null;
  }

  return createJwt({
    secret,
    expiresIn: process.env.RSK_JWT_EXPIRES_IN || DEFAULT_JWT_CONFIG.expiresIn,
    algorithm: process.env.RSK_JWT_ALGORITHM || DEFAULT_JWT_CONFIG.algorithm,
    issuer: process.env.RSK_JWT_ISSUER || DEFAULT_JWT_CONFIG.issuer,
    audience: process.env.RSK_JWT_AUDIENCE || DEFAULT_JWT_CONFIG.audience,
  });
}

/**
 * Configure JWT on Express app and return the instance
 *
 * Helper function to set JWT configuration on an Express app instance.
 *
 * @param {Object} app - Express app instance
 * @returns {Object|null} Configured JWT instance or null if secret not found
 */
export function configureJwt(app) {
  const jwt = createJwtFromEnv();

  if (!jwt) {
    return null;
  }

  app.set('jwt', jwt);

  return jwt;
}
