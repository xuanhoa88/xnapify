/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { WEBHOOK_STATUS } from '../utils/constants';

/**
 * Zod Validation Schema for Memory Adapter
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
      headers: z.record(z.string()).optional(),
    })
    .optional()
    .default({}),
});

/**
 * Memory Adapter for testing webhooks
 * Stores all webhooks in memory for verification
 */
export class MemoryWebhookAdapter {
  constructor(config = {}) {
    this.simulateDelay = config.simulateDelay || 0;
    this.failureRate = config.failureRate || 0;
    this.maxStoredWebhooks = config.maxStoredWebhooks || 1000;

    // Storage
    this.sentWebhooks = [];
    this.failedWebhooks = [];

    // Statistics
    this.stats = {
      sent: 0,
      failed: 0,
      lastSentAt: null,
    };
  }

  /**
   * Simulate network delay if configured
   * @private
   */
  async delay() {
    if (this.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.simulateDelay));
    }
  }

  /**
   * Check if should simulate failure
   * @private
   */
  shouldFail() {
    return this.failureRate > 0 && Math.random() < this.failureRate;
  }

  /**
   * Send a webhook (stores in memory)
   *
   * @param {Object} payload - Payload (must include url property)
   * @param {string} payload.url - Webhook URL
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
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
        adapter: 'memory',
      };
    }

    const { options: validatedOptions } = validation.data;
    // Extract url from payload, rest becomes stored data
    const { url, ...data } = payload;
    await this.delay();

    const timestamp = new Date().toISOString();
    const webhookId = uuidv4();

    // Simulate failure
    if (this.shouldFail()) {
      this.stats.failed++;
      const failedWebhook = {
        id: webhookId,
        url,
        payload: data,
        options: validatedOptions,
        error: 'Simulated failure',
        failedAt: timestamp,
      };
      this.failedWebhooks.push(failedWebhook);

      const error = new Error('Simulated webhook failure');
      error.code = 'SIMULATED_FAILURE';
      throw error;
    }

    const storedWebhook = {
      id: webhookId,
      url,
      payload: data,
      event: validatedOptions.event,
      headers: validatedOptions.headers,
      hasSignature: Boolean(validatedOptions.secret),
      sentAt: timestamp,
    };

    // Add to storage with limit
    this.sentWebhooks.push(storedWebhook);
    if (this.sentWebhooks.length > this.maxStoredWebhooks) {
      this.sentWebhooks.shift();
    }

    this.stats.sent++;
    this.stats.lastSentAt = timestamp;

    return {
      success: true,
      status: WEBHOOK_STATUS.DELIVERED,
      webhookId,
      url,
      statusCode: 200,
      responseBody: { received: true },
      timestamp,
      duration: this.simulateDelay,
      adapter: 'memory',
    };
  }

  /**
   * Get all sent webhooks
   * @param {Object} options - Filter options
   * @returns {Array} Sent webhooks
   */
  getSentWebhooks(options = {}) {
    let webhooks = [...this.sentWebhooks];

    if (options.url) {
      webhooks = webhooks.filter(w => w.url.includes(options.url));
    }

    if (options.event) {
      webhooks = webhooks.filter(w => w.event === options.event);
    }

    if (options.limit) {
      webhooks = webhooks.slice(-options.limit);
    }

    return webhooks;
  }

  /**
   * Get a specific webhook by ID
   * @param {string} webhookId - Webhook ID
   * @returns {Object|null} Webhook or null
   */
  getById(webhookId) {
    return this.sentWebhooks.find(w => w.id === webhookId) || null;
  }

  /**
   * Get the last sent webhook
   * @returns {Object|null} Last webhook or null
   */
  getLastWebhook() {
    return this.sentWebhooks.length > 0
      ? this.sentWebhooks[this.sentWebhooks.length - 1]
      : null;
  }

  /**
   * Get failed webhooks
   * @returns {Array} Failed webhooks
   */
  getFailedWebhooks() {
    return [...this.failedWebhooks];
  }

  /**
   * Clear all stored webhooks
   */
  clear() {
    this.sentWebhooks = [];
    this.failedWebhooks = [];
    this.stats = {
      sent: 0,
      failed: 0,
      lastSentAt: null,
    };
  }

  /**
   * Get adapter statistics
   * @returns {Object} Stats
   */
  getStats() {
    return {
      adapter: 'memory',
      storedWebhooks: this.sentWebhooks.length,
      maxStoredWebhooks: this.maxStoredWebhooks,
      simulateDelay: this.simulateDelay,
      failureRate: this.failureRate,
      ...this.stats,
    };
  }
}
