/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { DEFAULTS } from '../utils/constants';
import { createSignatureHeader } from '../utils/signature';
import {
  createValidationErrorResponse,
  createSuccessResponse,
  createErrorResponse,
} from '../utils/adapter-responses';
import {
  urlSchema,
  eventSchema,
  secretSchema,
  algorithmSchema,
  timeoutSchema,
  headersSchema,
} from '../utils/adapter-schemas';

/**
 * HTTP Adapter Options Schema
 */
const httpOptionsSchema = z.object({
  url: urlSchema.optional(),
  event: eventSchema,
  secret: secretSchema.optional(),
  algorithm: algorithmSchema,
  timeout: timeoutSchema.optional(),
  headers: headersSchema.optional(),
});

const sendInputSchema = httpOptionsSchema.passthrough();
// validateInput is no longer needed

/**
 * HTTP Adapter for sending webhooks via fetch
 * URL can be configured in constructor or passed in options
 */
export class HttpWebhookAdapter {
  constructor(config = {}) {
    this.url = config.url || null;
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
   * @param {any} data - Data to send
   * @param {Object} options - Send options
   * @param {string} options.url - URL override (optional if configured in constructor)
   * @returns {Promise<Object>} Delivery result
   */
  async send(data, options = {}) {
    // In this flat adapter model, 'data' contains everything.
    // 'options' is kept for backward compatibility but merged if provided.
    const input = { ...data, ...options };
    const validation = sendInputSchema.safeParse(input);

    if (!validation.success) {
      return createValidationErrorResponse('http', validation.error);
    }

    const {
      url: optionsUrl,
      timeout: optionsTimeout,
      headers: optionsHeaders,
      event,
      secret,
      algorithm,
      ...payload
    } = validation.data;

    const url = optionsUrl || this.url;

    if (!url) {
      return createValidationErrorResponse('http', {
        message:
          'URL is required (configure in constructor or pass in options)',
        flatten: () => ({ fieldErrors: { url: ['Required'] } }),
      });
    }

    const timeout = optionsTimeout || this.timeout;
    const timestamp = Date.now();
    const body = JSON.stringify(payload);
    const webhookId = uuidv4();

    // Build headers
    const headers = {
      ...this.defaultHeaders,
      ...optionsHeaders,
      [DEFAULTS.TIMESTAMP_HEADER]: String(timestamp),
    };

    if (event) {
      headers[DEFAULTS.EVENT_HEADER] = event;
    }

    if (secret) {
      headers[DEFAULTS.SIGNATURE_HEADER] = createSignatureHeader(
        body,
        secret,
        algorithm,
      );
    }

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
        return createErrorResponse(
          'http',
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP_ERROR',
          {
            webhookId,
            url,
            statusCode: response.status,
            responseBody,
            duration: Date.now() - timestamp,
          },
        );
      }

      this.stats.sent++;
      this.stats.lastSentAt = new Date().toISOString();

      return createSuccessResponse('http', {
        webhookId,
        url,
        statusCode: response.status,
        responseBody,
        duration: Date.now() - timestamp,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      this.stats.failed++;

      let code = 'DELIVERY_FAILED';
      let { message } = error;

      if (error.name === 'AbortError') {
        code = 'TIMEOUT';
        message = `Request timed out after ${timeout}ms`;
      }

      return createErrorResponse('http', message, code, {
        webhookId,
        url,
        duration: Date.now() - timestamp,
        details: error,
      });
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
      total: this.stats.sent + this.stats.failed,
      delivered: this.stats.sent,
      failed: this.stats.failed,
      pending: 0,
      timeout: this.timeout,
      lastSentAt: this.stats.lastSentAt,
    };
  }

  /**
   * Get webhooks (not supported - HTTP adapter doesn't store webhooks)
   * Returns empty pagination result for interface compatibility
   * @param {Object} options
   * @returns {Promise<Object>} Empty pagination result
   */
  async getWebhooks(options = {}) {
    const { limit = 20, offset = 0 } = options;
    return {
      data: [],
      total: 0,
      limit,
      offset,
      hasMore: false,
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

  /**
   * Cleanup old webhooks (not supported - HTTP adapter doesn't store webhooks)
   * Returns 0 for interface compatibility
   * @returns {Promise<number>} Number of deleted records (always 0)
   */
  async cleanup() {
    return 0;
  }

  /**
   * Update webhook status (not supported - HTTP adapter doesn't store webhooks)
   * Returns null for interface compatibility
   * @param {string} _webhookId - Webhook ID (unused)
   * @param {Object} _result - Delivery result (unused)
   * @returns {Promise<Object|null>} Always returns null
   */
  async updateStatus(_webhookId, _result) {
    return null;
  }
}
