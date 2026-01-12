/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Webhook delivery status
 */
export const WEBHOOK_STATUS = Object.freeze({
  PENDING: 'pending',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RETRYING: 'retrying',
});

/**
 * Default configuration
 */
export const DEFAULTS = Object.freeze({
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second base delay
  RETRY_MULTIPLIER: 2, // Exponential backoff multiplier
  MAX_RETRY_DELAY: 30000, // Max 30 seconds between retries
  CONTENT_TYPE: 'application/json',
  SIGNATURE_HEADER: 'X-Webhook-Signature',
  TIMESTAMP_HEADER: 'X-Webhook-Timestamp',
  EVENT_HEADER: 'X-Webhook-Event',
});

/**
 * Signature algorithms
 */
export const SIGNATURE_ALGORITHMS = Object.freeze({
  SHA256: 'sha256',
  SHA512: 'sha512',
});
