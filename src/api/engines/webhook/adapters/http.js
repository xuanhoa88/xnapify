/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULTS, WEBHOOK_STATUS } from '../utils/constants';
import { createSignatureHeader } from '../utils/signature';
import { WebhookDeliveryError, WebhookTimeoutError } from '../errors';

/**
 * Zod Validation Schema for HTTP Adapter
 */
const sendInputSchema = z.object({
  payload: z
    .object({
      url: z.string().min(1).max(2048).url(),
    })
    .passthrough(),
  options: z
    .object({
      event: z.string().max(1024).optional(),
      secret: z.string().optional(),
      algorithm: z.string().optional(),
      timeout: z.number().int().min(1000).max(60000).optional(),
      headers: z.record(z.string()).optional(),
    })
    .optional()
    .default({}),
});

/**
 * HTTP Adapter for sending webhooks via fetch
 */
export class HttpWebhookAdapter {
  constructor(config = {}) {
    this.timeout = config.timeout || DEFAULTS.TIMEOUT;
    this.defaultHeaders = {
      'Content-Type': DEFAULTS.CONTENT_TYPE,
      ...config.headers,
    };

    // Statistics
    this.stats = {
      sent: 0,
      failed: 0,
      lastSentAt: null,
    };
  }

  /**
   * Send a webhook request
   *
   * @param {Object} payload - Payload to send (must include url property)
   * @param {string} payload.url - Webhook destination URL
   * @param {Object} options - Send options
   * @returns {Promise<Object>} Delivery result
   */
  async send(payload, options = {}) {
    // Validate input
    const validation = sendInputSchema.safeParse({ payload, options });
    if (!validation.success) {
      return {
        success: false,
        status: WEBHOOK_STATUS.FAILED,
        error: {
          message: validation.error.message,
          code: 'VALIDATION_ERROR',
          details: validation.error.flatten(),
        },
        timestamp: new Date().toISOString(),
        adapter: 'http',
      };
    }

    const { options: validatedOptions } = validation.data;
    // Extract url from payload, rest becomes the body
    const { url, ...data } = payload;
    const timeout = validatedOptions.timeout || this.timeout;
    const timestamp = Date.now();
    const body = JSON.stringify(data);
    const webhookId = uuidv4();

    // Build headers
    const headers = {
      ...this.defaultHeaders,
      ...validatedOptions.headers,
      [DEFAULTS.TIMESTAMP_HEADER]: String(timestamp),
    };

    // Add event header if provided
    if (validatedOptions.event) {
      headers[DEFAULTS.EVENT_HEADER] = validatedOptions.event;
    }

    // Add signature if secret is provided
    if (validatedOptions.secret) {
      headers[DEFAULTS.SIGNATURE_HEADER] = createSignatureHeader(
        body,
        validatedOptions.secret,
        validatedOptions.algorithm,
      );
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await this.parseResponse(response);

      if (!response.ok) {
        this.stats.failed++;
        throw new WebhookDeliveryError(
          `HTTP ${response.status}: ${response.statusText}`,
          url,
          response.status,
        );
      }

      this.stats.sent++;
      this.stats.lastSentAt = new Date().toISOString();

      return {
        success: true,
        status: WEBHOOK_STATUS.DELIVERED,
        webhookId,
        url,
        statusCode: response.status,
        responseBody,
        timestamp: new Date(timestamp).toISOString(),
        duration: Date.now() - timestamp,
        adapter: 'http',
      };
    } catch (error) {
      clearTimeout(timeoutId);
      this.stats.failed++;

      if (error.name === 'AbortError') {
        throw new WebhookTimeoutError(url, timeout);
      }

      if (error instanceof WebhookDeliveryError) {
        throw error;
      }

      throw new WebhookDeliveryError(error.message, url, null, error);
    }
  }

  /**
   * Parse response body
   * @private
   */
  async parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch {
      return null;
    }
  }

  /**
   * Get adapter statistics
   * @returns {Object} Stats
   */
  getStats() {
    return {
      adapter: 'http',
      timeout: this.timeout,
      ...this.stats,
    };
  }

  /**
   * Get webhook by ID (not supported - HTTP adapter doesn't store webhooks)
   * @param {string} _webhookId - Webhook ID (unused)
   * @returns {null} Always returns null
   */
  getById(_webhookId) {
    return null;
  }
}
