/**
 * Password Security Utilities
 *
 * Provides utilities for secure password handling, hashing, and validation.
 * Implements modern security best practices for password management.
 */

import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

/**
 * Default password configuration
 */
const DEFAULT_PASSWORD_CONFIG = {
  saltLength: 32,
  keyLength: 64,
  iterations: 16384, // scrypt N parameter
  blockSize: 8, // scrypt r parameter
  parallelization: 1, // scrypt p parameter
};

/**
 * Password strength requirements
 */
const DEFAULT_STRENGTH_CONFIG = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  forbidCommonPasswords: true,
};

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
    throw new Error('Invalid hash format');
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
export function generateSecurePassword(options = {}) {
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
 * Validate password strength
 *
 * @param {string} password - Password to validate
 * @param {Object} [options] - Validation options
 * @returns {Object} Validation result
 */
export function validatePasswordStrength(password, options = {}) {
  const config = { ...DEFAULT_STRENGTH_CONFIG, ...options };
  const errors = [];
  let score = 0;

  // Length validation
  if (password.length < config.minLength) {
    errors.push(
      `Password must be at least ${config.minLength} characters long`,
    );
  } else if (password.length >= config.minLength) {
    score += 1;
  }

  if (password.length > config.maxLength) {
    errors.push(`Password must not exceed ${config.maxLength} characters`);
  }

  // Character type validation
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (/[A-Z]/.test(password)) {
    score += 1;
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (/[a-z]/.test(password)) {
    score += 1;
  }

  if (config.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else if (/[0-9]/.test(password)) {
    score += 1;
  }

  if (config.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  }

  // Common password check (basic implementation)
  if (config.forbidCommonPasswords) {
    const commonPasswords = [
      'password',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
      'password123',
      'admin',
      'letmein',
      'welcome',
      'monkey',
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
    }
  }

  // Calculate strength level
  let strength = 'weak';
  if (score >= 4 && errors.length === 0) {
    strength = 'strong';
  } else if (score >= 3 && errors.length === 0) {
    strength = 'medium';
  }

  return {
    valid: errors.length === 0,
    errors,
    strength,
    score,
  };
}

/**
 * Generate a password reset token
 *
 * @param {number} [length=32] - Token length in bytes
 * @returns {string} Secure reset token
 */
export function generateResetToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Create a time-limited password reset token
 *
 * @param {string} userId - User ID
 * @param {number} [expiresIn=3600] - Expiration time in seconds
 * @returns {Object} Reset token data
 */
export function createTimedResetToken(userId, expiresIn = 3600) {
  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    token,
    userId,
    expiresAt,
    createdAt: new Date(),
  };
}

/**
 * Validate a timed reset token
 *
 * @param {Object} tokenData - Token data from storage
 * @returns {Object} Validation result
 */
export function validateResetToken(tokenData) {
  const errors = [];

  if (!tokenData) {
    errors.push('Reset token not found');
  } else {
    if (new Date() > new Date(tokenData.expiresAt)) {
      errors.push('Reset token has expired');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
