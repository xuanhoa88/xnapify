/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Base Webhook Error
 */
export class WebhookError extends Error {
  constructor(message, code = 'WEBHOOK_ERROR', status = 500) {
    super(message);
    this.name = 'WebhookError';
    this.code = code;
    this.status = status;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WebhookError);
    }
  }
}

/**
 * Webhook Validation Error — invalid provider config, missing secret, etc.
 */
export class WebhookValidationError extends WebhookError {
  constructor(message, field = null) {
    super(`Webhook validation failed: ${message}`, 'VALIDATION_ERROR', 400);
    this.name = 'WebhookValidationError';
    this.field = field;
  }
}
