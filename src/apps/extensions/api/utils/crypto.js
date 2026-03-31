/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Key derivation — domain-separated from JWT secret
// ---------------------------------------------------------------------------

/**
 * Domain separator for HKDF-style key derivation.
 * Ensures the extension encryption key is cryptographically isolated
 * from the JWT signing key even though both derive from XNAPIFY_KEY.
 */
const EXT_CRYPTO_DOMAIN = 'xnapify:extension-id-obfuscation';

/**
 * Derive a 256-bit encryption key from the master secret.
 * Returns null (and warns) if no master key is configured,
 * which gracefully disables encryption in pure-SSR mode.
 */
function deriveExtensionKey() {
  const masterKey = process.env.XNAPIFY_KEY;
  if (!masterKey) {
    console.warn(
      '[crypto] XNAPIFY_KEY not set — extension ID encryption disabled',
    );
    return null;
  }
  return crypto
    .createHmac('sha256', masterKey)
    .update(EXT_CRYPTO_DOMAIN)
    .digest();
}

const EXTENSION_KEY = deriveExtensionKey();

// ---------------------------------------------------------------------------
// AES-256-GCM encryption
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV (NIST recommendation for GCM)
const TAG_LENGTH = 16; // 128-bit authentication tag

/**
 * Encrypt extension ID
 *
 * Output format (hex-encoded): IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
 *
 * @param {string} id - Plain extension ID
 * @returns {string} Encrypted ID (hex) or the original ID if encryption is disabled
 */
export function encryptExtensionId(id) {
  if (!EXTENSION_KEY) return id;

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, EXTENSION_KEY, iv, {
      authTagLength: TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
      cipher.update(id, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Pack: iv + tag + ciphertext → hex
    return Buffer.concat([iv, tag, encrypted]).toString('hex');
  } catch (error) {
    console.error('Failed to encrypt extension ID:', error);
    return id; // Fallback to plain ID on error
  }
}

/**
 * Decrypt extension ID
 *
 * Expects a hex string in the format: IV (12) + AuthTag (16) + Ciphertext
 *
 * @param {string} token - Encrypted ID (hex)
 * @returns {string|null} Plain extension ID or null if invalid/tampered
 */
export function decryptExtensionId(token) {
  // Encrypted IDs are pure hex — skip if it contains non-hex chars (e.g. UUID dashes)
  if (!token || !/^[0-9a-f]+$/i.test(token)) {
    return null;
  }

  if (!EXTENSION_KEY) return null;

  try {
    const buf = Buffer.from(token, 'hex');

    // Minimum size: IV + Tag + at least 1 byte of ciphertext
    if (buf.length < IV_LENGTH + TAG_LENGTH + 1) return null;

    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, EXTENSION_KEY, iv, {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}
