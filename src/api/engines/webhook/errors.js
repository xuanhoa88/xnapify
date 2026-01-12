/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WebhookError);
    }
  }
}

/**
 * Webhook Delivery Error
 */
export class WebhookDeliveryError extends WebhookError {
  constructor(message, url, statusCode = null, originalError = null) {
    super(`Webhook delivery failed: ${message}`, 'DELIVERY_ERROR', 502);
    this.name = 'WebhookDeliveryError';
    this.url = url;
    this.responseStatus = statusCode;
    this.originalError = originalError;
  }
}

/**
 * Webhook Validation Error
 */
export class WebhookValidationError extends WebhookError {
  constructor(message, field = null) {
    super(`Webhook validation failed: ${message}`, 'VALIDATION_ERROR', 400);
    this.name = 'WebhookValidationError';
    this.field = field;
  }
}

/**
 * Webhook Timeout Error
 */
export class WebhookTimeoutError extends WebhookError {
  constructor(url, timeout) {
    super(`Webhook request timed out after ${timeout}ms`, 'TIMEOUT_ERROR', 504);
    this.name = 'WebhookTimeoutError';
    this.url = url;
    this.timeout = timeout;
  }
}

/**
 * Webhook Worker Error
 */
export class WebhookWorkerError extends WebhookError {
  constructor(message, code = 'WORKER_ERROR', status = 500) {
    super(message, code, status);
    this.name = 'WebhookWorkerError';
  }
}

/**
 * Create standardized operation result object
 *
 * @param {boolean} success - Success status
 * @param {*} data - Response data
 * @param {string} message - Response message
 * @param {Error} error - Error object (optional)
 * @returns {Object} Standardized operation result
 */
export function createOperationResult(
  success,
  data = null,
  message = '',
  error = null,
) {
  const response = {
    success,
    data,
    message,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    response.error = {
      message: error.message,
      code: error.code || 'WEBHOOK_ERROR',
      status: error.status || 500,
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
      response.error.stack = error.stack;
    }
  }

  return response;
}
