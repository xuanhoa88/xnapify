/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Webhook event names used with HookChannel
 */
export const WEBHOOK_EVENTS = Object.freeze({
  /** Prefix for provider handlers: handler:<provider> */
  HANDLER: 'handler',
  /** Fires before handler dispatch (sequential) */
  BEFORE_HANDLE: 'beforeHandle',
  /** Fires after handler dispatch (sequential) */
  AFTER_HANDLE: 'afterHandle',
});

/**
 * Supported HMAC signature algorithms
 */
export const SIGNATURE_ALGORITHMS = Object.freeze({
  SHA256: 'sha256',
  SHA512: 'sha512',
});
