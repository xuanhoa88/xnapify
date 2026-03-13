/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';

import { SIGNATURE_ALGORITHMS } from './constants';

/**
 * Generate HMAC signature for webhook payload
 *
 * @param {string|Object} payload - Payload to sign
 * @param {string} secret - Secret key for signing
 * @param {string} algorithm - Hashing algorithm (default: sha256)
 * @returns {string} Hex-encoded signature
 */
export function generateSignature(
  payload,
  secret,
  algorithm = SIGNATURE_ALGORITHMS.SHA256,
) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac(algorithm, secret).update(data).digest('hex');
}

/**
 * Verify webhook signature
 *
 * @param {string|Object} payload - Original payload
 * @param {string} signature - Signature to verify
 * @param {string} secret - Secret key used for signing
 * @param {string} algorithm - Hashing algorithm (default: sha256)
 * @returns {boolean} True if signature is valid
 */
export function verifySignature(
  payload,
  signature,
  secret,
  algorithm = SIGNATURE_ALGORITHMS.SHA256,
) {
  const expectedSignature = generateSignature(payload, secret, algorithm);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

/**
 * Create signature header value with algorithm prefix
 *
 * @param {string|Object} payload - Payload to sign
 * @param {string} secret - Secret key
 * @param {string} algorithm - Algorithm (default: sha256)
 * @returns {string} Formatted signature (e.g., "sha256=abc123...")
 */
export function createSignatureHeader(
  payload,
  secret,
  algorithm = SIGNATURE_ALGORITHMS.SHA256,
) {
  const signature = generateSignature(payload, secret, algorithm);
  return `${algorithm}=${signature}`;
}
