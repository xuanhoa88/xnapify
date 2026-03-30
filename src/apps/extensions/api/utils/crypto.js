/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';

// Derive encryption key from JWT secret for consistent ID obfuscation
const EXTENSION_KEY = crypto
  .createHash('sha256')
  .update(process.env.XNAPIFY_JWT_SECRET || __filename)
  .digest();

/**
 * Encrypt extension ID
 * @param {string} id - Plain extension ID
 * @returns {string} Encrypted ID (hex)
 */
export function encryptExtensionId(id) {
  try {
    const cipher = crypto.createCipheriv('aes-256-ecb', EXTENSION_KEY, null);
    let encrypted = cipher.update(id, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('Failed to encrypt extension ID:', error);
    return id; // Fallback to plain ID on error
  }
}

/**
 * Decrypt extension ID
 * @param {string} token - Encrypted ID (hex)
 * @returns {string|null} Plain extension ID or null if invalid
 */
export function decryptExtensionId(token) {
  // Encrypted IDs are pure hex — skip if it contains non-hex chars (e.g. UUID dashes)
  if (!token || !/^[0-9a-f]+$/i.test(token)) {
    return null;
  }

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-ecb',
      EXTENSION_KEY,
      null,
    );
    let decrypted = decipher.update(token, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}
