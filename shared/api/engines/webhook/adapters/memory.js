/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

import { z } from '@shared/validator';

import {
  createValidationErrorResponse,
  createSuccessResponse,
  createErrorResponse,
} from '../utils/adapter-responses';
import { eventSchema, metadataSchema } from '../utils/adapter-schemas';
import { WEBHOOK_STATUS } from '../utils/constants';

/**
 * Memory Adapter Options Schema
 */
const memoryOptionsSchema = z.object({
  event: eventSchema,
  metadata: metadataSchema,
});

const sendInputSchema = memoryOptionsSchema.passthrough();
// validateInput is no longer needed

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
    this.webhooks = [];

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
   * @param {any} data - Data to store
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async send(data, options = {}) {
    // In this flat adapter model, 'data' contains everything.
    // 'options' is kept for backward compatibility but merged if provided.
    const input = { ...data, ...options };
    const validation = sendInputSchema.safeParse(input);

    if (!validation.success) {
      return createValidationErrorResponse('memory', validation.error);
    }

    const { event, ...metadata } = validation.data;
    await this.delay();

    const timestamp = new Date().toISOString();
    const webhookId = uuidv4();

    const webhook = {
      id: webhookId,
      metadata,
      event,
      created_at: timestamp,
      updated_at: timestamp,
    };

    // Simulate failure
    if (this.shouldFail()) {
      this.stats.failed++;
      webhook.status = WEBHOOK_STATUS.FAILED;

      // Store failed webhook
      this.webhooks.push(webhook);

      return createErrorResponse(
        'memory',
        'Simulated webhook failure',
        'SIMULATED_FAILURE',
        {
          webhookId,
          duration: this.simulateDelay,
        },
      );
    }

    webhook.status = WEBHOOK_STATUS.DELIVERED;

    // Add to storage with limit
    this.webhooks.push(webhook);
    if (this.webhooks.length > this.maxStoredWebhooks) {
      this.webhooks.shift();
    }

    this.stats.sent++;
    this.stats.lastSentAt = timestamp;

    return createSuccessResponse('memory', {
      webhookId,
      statusCode: 200,
      responseBody: { received: true },
      duration: this.simulateDelay,
    });
  }

  /**
   * Get a specific webhook by ID
   * @param {string} webhookId - Webhook ID
   * @returns {Object|null} Webhook or null
   */
  getById(webhookId) {
    return this.webhooks.find(w => w.id === webhookId) || null;
  }

  /**
   * Clear all stored webhooks
   */
  clear() {
    this.webhooks = [];
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
      total: this.stats.sent + this.stats.failed,
      delivered: this.stats.sent,
      failed: this.stats.failed,
      pending: 0,
      lastSentAt: this.stats.lastSentAt,
      // Memory specific
      storedWebhooks: this.webhooks.length,
      maxStoredWebhooks: this.maxStoredWebhooks,
      simulateDelay: this.simulateDelay,
      failureRate: this.failureRate,
    };
  }

  /**
   * Update webhook status (mock implementation)
   */
  async updateStatus(webhookId, result) {
    const webhook = this.webhooks.find(w => w.id === webhookId);
    if (!webhook) return null;

    webhook.status = result.success
      ? WEBHOOK_STATUS.DELIVERED
      : WEBHOOK_STATUS.FAILED;
    webhook.attempts = (webhook.attempts || 0) + 1;

    if (result.nextRetryAt) {
      webhook.next_retry_at = result.nextRetryAt;
    }

    return webhook;
  }

  /**
   * Get pending retries (mock implementation)
   */
  async getPendingRetries(options = {}) {
    const limit = options.limit || 100;
    const now = new Date();

    return this.webhooks
      .filter(w => {
        return (
          w.status === WEBHOOK_STATUS.FAILED &&
          w.next_retry_at &&
          new Date(w.next_retry_at) <= now
        );
      })
      .slice(0, limit);
  }

  /**
   * Get webhooks with pagination (mock implementation)
   */
  async getWebhooks(options = {}) {
    let hooks = [...this.webhooks].reverse(); // Newest first

    if (options.status) {
      hooks = hooks.filter(w => w.status === options.status);
    }
    if (options.event) {
      hooks = hooks.filter(w => w.event === options.event);
    }

    const total = hooks.length;
    const offset = options.offset || 0;
    const limit = options.limit || 20;

    return {
      data: hooks.slice(offset, offset + limit),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Cleanup old webhooks (mock implementation)
   */
  async cleanup(options = {}) {
    console.info('🧹 Cleaning up expired memory webhook entries...');
    const { olderThan = 30 } = options;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThan);

    const initialCount = this.webhooks.length;
    this.webhooks = this.webhooks.filter(w => {
      const sentAt = new Date(w.sentAt || w.failedAt || Date.now());
      return sentAt >= cutoff;
    });

    return initialCount - this.webhooks.length;
  }
}
