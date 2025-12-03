/**
 * JWT Utilities
 *
 * Comprehensive JWT token management utilities for authentication.
 * Provides token generation, verification, and validation functions.
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
      const error = new Error('Token has expired');
      error.name = 'TokenExpiredError';
      error.status = 401;
      throw error;
    }
    if (error.name === 'JsonWebTokenError') {
      const error = new Error('Invalid token format');
      error.name = 'InvalidTokenFormatError';
      error.status = 401;
      throw error;
    }
    if (error.name === 'NotBeforeError') {
      const error = new Error('Token not active yet');
      error.name = 'TokenNotActiveError';
      error.status = 401;
      throw error;
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

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_TOKEN_TYPES.access.expiresIn,
  };
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
    expiresIn: JWT_TOKEN_TYPES.access.expiresIn,
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
    errors.push(
      'Invalid algorithm. Must be one of: HS256, HS384, HS512, RS256, RS384, RS512',
    );
  }

  if (
    config.expiresIn &&
    typeof config.expiresIn !== 'string' &&
    typeof config.expiresIn !== 'number'
  ) {
    errors.push('expiresIn must be a string or number');
  }

  if (
    config.issuer &&
    (typeof config.issuer !== 'string' || config.issuer.trim().length === 0)
  ) {
    errors.push('issuer must be a string');
  }

  if (
    config.audience &&
    (typeof config.audience !== 'string' || config.audience.trim().length === 0)
  ) {
    errors.push('audience must be a string');
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

  return {
    ...DEFAULT_JWT_CONFIG,
    ...tokenConfig,
    ...overrides,
  };
}
