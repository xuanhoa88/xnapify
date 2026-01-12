/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * HTTP Send Worker - Handles webhook delivery via HTTP
 * Focuses only on HTTP delivery with retries and exponential backoff.
 * No database logic - this is a pure HTTP delivery worker.
 */

import { createWorkerHandler, setupWorkerProcess } from '../../worker';
import { WebhookError } from '../errors';
import { HttpWebhookAdapter } from '../adapters';
import { DEFAULTS, WEBHOOK_STATUS } from '../utils/constants';

// Create HTTP adapter for worker
const httpAdapter = new HttpWebhookAdapter();

/**
 * Calculate retry delay with exponential backoff
 * @private
 */
function getRetryDelay(attempt, options = {}) {
  const baseDelay = options.retryDelay || DEFAULTS.RETRY_DELAY;
  const multiplier = options.retryMultiplier || DEFAULTS.RETRY_MULTIPLIER;
  const maxDelay = options.maxRetryDelay || DEFAULTS.MAX_RETRY_DELAY;

  const delay = baseDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep helper
 * @private
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Deliver single webhook with retries
 * @private
 */
async function deliverWebhook(webhook, options = {}) {
  const { payload } = webhook;
  const url = payload && payload.url;
  const webhookOptions = { ...options, ...webhook.options };
  const maxRetries =
    webhookOptions.retries != null
      ? webhookOptions.retries
      : DEFAULTS.MAX_RETRIES;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await httpAdapter.send(payload, webhookOptions);
      return {
        ...result,
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = getRetryDelay(attempt, webhookOptions);
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    status: WEBHOOK_STATUS.FAILED,
    url,
    error: {
      message: lastError.message,
      code: lastError.code || 'DELIVERY_FAILED',
    },
    attempts: maxRetries + 1,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Process HTTP send operations
 * @param {Object} data - Send data
 * @returns {Promise<Object>} Send result
 */
async function processSend(data) {
  const { webhooks, options = {} } = data;
  const webhookList = Array.isArray(webhooks) ? webhooks : [webhooks];

  if (webhookList.length === 0) {
    throw new WebhookError(
      'At least one webhook is required',
      'INVALID_INPUT',
      400,
    );
  }

  // Process webhooks with concurrency control
  const concurrency = options.concurrency || 5;
  const results = {
    successful: [],
    failed: [],
    total: webhookList.length,
  };

  const chunks = [];
  for (let i = 0; i < webhookList.length; i += concurrency) {
    chunks.push(webhookList.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async webhook => {
      const result = await deliverWebhook(webhook, options);

      if (result.success) {
        results.successful.push({
          url: webhook.payload.url,
          webhookId: result.webhookId,
          statusCode: result.statusCode,
          attempts: result.attempts,
        });
      } else {
        results.failed.push({
          url: webhook.payload.url,
          error: result.error,
          attempts: result.attempts,
        });
      }

      return result;
    });

    await Promise.all(promises);
  }

  return {
    success: results.failed.length === 0,
    ...results,
    successCount: results.successful.length,
    failCount: results.failed.length,
    timestamp: new Date().toISOString(),
  };
}

// Create worker function using helper
const workerFunction = createWorkerHandler(processSend, 'SEND_WEBHOOK');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupWorkerProcess(processSend, 'SEND_WEBHOOK', 'Webhook HTTP');
