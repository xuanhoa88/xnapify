/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';

import { SIGNATURE_ALGORITHMS } from './constants';

/**
 * Parse a signature header value with algorithm prefix.
 *
 * @param {string} header - Value like "sha256=abc123..."
 * @returns {{ algorithm: string, signature: string }}
 *
 * @example
 * parseSignatureHeader('sha256=deadbeef')
 * // { algorithm: 'sha256', signature: 'deadbeef' }
 */
export function parseSignatureHeader(header) {
  if (!header || typeof header !== 'string') {
    return { algorithm: SIGNATURE_ALGORITHMS.SHA256, signature: '' };
  }

  const idx = header.indexOf('=');
  if (idx === -1) {
    // No prefix — assume sha256
    return { algorithm: SIGNATURE_ALGORITHMS.SHA256, signature: header };
  }

  return {
    algorithm: header.slice(0, idx),
    signature: header.slice(idx + 1),
  };
}

/**
 * Verify an HMAC signature against a payload.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param {string|Object} payload - The raw request body
 * @param {string} signature - The hex-encoded signature to verify
 * @param {string} secret - Shared secret key
 * @param {string} [algorithm='sha256'] - HMAC algorithm
 * @returns {boolean} True if the signature is valid
 *
 * @example
 * const isValid = verifySignature(req.body, sig, process.env.WEBHOOK_SECRET);
 */
export function verifySignature(
  payload,
  signature,
  secret,
  algorithm = SIGNATURE_ALGORITHMS.SHA256,
) {
  if (!signature || !secret) return false;

  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const expected = crypto
    .createHmac(algorithm, secret)
    .update(data)
    .digest('hex');

  // Guard against length mismatch (timingSafeEqual requires equal lengths)
  if (signature.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
