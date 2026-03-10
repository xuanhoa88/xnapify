/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { decodeToken } from './core';

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
