/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';
import { promisify } from 'util';

// Promisify crypto functions
const scrypt = promisify(crypto.scrypt);

/**
 * Default password configuration
 */
const DEFAULT_PASSWORD_CONFIG = Object.freeze({
  saltLength: 32,
  keyLength: 64,
  iterations: 16384, // scrypt N parameter
  blockSize: 8, // scrypt r parameter
  parallelization: 1, // scrypt p parameter
});

/**
 * Hash a password using scrypt
 *
 * @param {string} password - Plain text password
 * @param {Object} [options] - Hashing options
 * @returns {Promise<string>} Hashed password with salt
 */
export async function hashPassword(password, options = {}) {
  const config = { ...DEFAULT_PASSWORD_CONFIG, ...options };

  const salt = crypto.randomBytes(config.saltLength);
  const derivedKey = await scrypt(password, salt, config.keyLength, {
    N: config.iterations,
    r: config.blockSize,
    p: config.parallelization,
  });

  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against its hash
 *
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password (salt:hash format)
 * @param {Object} [options] - Verification options
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(password, hashedPassword, options = {}) {
  const config = { ...DEFAULT_PASSWORD_CONFIG, ...options };

  const [saltHex, hashHex] = hashedPassword.split(':');
  if (!saltHex || !hashHex) {
    const error = new Error('Invalid hash format');
    error.name = 'InvalidPasswordHashFormatError';
    error.status = 400;
    throw error;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const hash = Buffer.from(hashHex, 'hex');

  const derivedKey = await scrypt(password, salt, config.keyLength, {
    N: config.iterations,
    r: config.blockSize,
    p: config.parallelization,
  });

  return crypto.timingSafeEqual(hash, derivedKey);
}

/**
 * Generate a secure random password
 *
 * @param {Object} [options] - Generation options
 * @param {number} [options.length=16] - Password length
 * @param {boolean} [options.includeSymbols=true] - Include symbols
 * @param {boolean} [options.excludeAmbiguous=true] - Exclude ambiguous chars
 * @returns {string} Generated password
 */
export function generatePassword(options = {}) {
  const {
    length = 16,
    includeSymbols = true,
    excludeAmbiguous = true,
  } = options;

  let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  if (includeSymbols) {
    chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  }

  if (excludeAmbiguous) {
    chars = chars.replace(/[0O1lI]/g, '');
  }

  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    password += chars[randomIndex];
  }

  return password;
}

/**
 * Hash a token for secure storage using SHA-256
 *
 * @param {string} token - Raw token string
 * @returns {string} Hashed token (hex encoded)
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a time-limited password reset token
 *
 * Returns both the raw token (to send to user) and the hashed token (to store in database).
 * Only store the hashedToken in your database for security.
 *
 * @param {string} userId - User ID
 * @param {Object} [options] - Token options
 * @param {number} [options.expiresIn=3600] - Expiration time in seconds
 * @param {number} [options.tokenSize=32] - Token size in bytes (results in hex string of 2x length)
 * @returns {Object} Reset token data with { token, hashedToken, userId, expiresAt, createdAt, usedAt }
 */
export function createTimedResetToken(userId, options = {}) {
  const { expiresIn = 3600, tokenSize = 32 } = options;
  const token = crypto.randomBytes(tokenSize).toString('hex');
  const hashedToken = hashToken(token);

  return {
    token, // Send this to the user (e.g., in reset email)
    hashedToken, // Store this in database
    userId,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    createdAt: new Date(),
    usedAt: null, // Set this when token is used to prevent reuse
  };
}

/**
 * Validate a timed reset token
 *
 * Performs timing-safe comparison of the submitted token against stored hash,
 * checks expiration, and verifies the token hasn't been used.
 *
 * @param {string} submittedToken - Raw token submitted by user
 * @param {Object} tokenData - Token data from storage (should contain hashedToken)
 * @returns {Object} Validation result with { valid, errors }
 */
export function validateResetToken(submittedToken, tokenData) {
  const errors = [];

  if (!submittedToken) {
    errors.push('TOKEN_REQUIRED');
    return { valid: false, errors };
  }

  if (!tokenData) {
    errors.push('TOKEN_NOT_FOUND');
    return { valid: false, errors };
  }

  // Timing-safe comparison of hashed tokens
  const submittedHash = hashToken(submittedToken);
  const storedHash = tokenData.hashedToken;

  if (!storedHash) {
    errors.push('TOKEN_INVALID');
  } else {
    try {
      const submittedBuffer = Buffer.from(submittedHash, 'hex');
      const storedBuffer = Buffer.from(storedHash, 'hex');

      if (
        submittedBuffer.length !== storedBuffer.length ||
        !crypto.timingSafeEqual(submittedBuffer, storedBuffer)
      ) {
        errors.push('TOKEN_INVALID');
      }
    } catch {
      errors.push('TOKEN_INVALID');
    }
  }

  // Check expiration
  if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
    errors.push('TOKEN_EXPIRED');
  }

  // Check if already used (single-use enforcement)
  if (tokenData.usedAt) {
    errors.push('TOKEN_USED');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
