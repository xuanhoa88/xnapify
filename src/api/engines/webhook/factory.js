/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  HttpWebhookAdapter,
  MemoryWebhookAdapter,
  DatabaseWebhookAdapter,
} from './adapters';
import { WebhookError, WebhookValidationError } from './errors';
import { DEFAULTS, WEBHOOK_STATUS } from './utils/constants';
import { validateWebhook } from './utils/validation';
import workerPool from './workers';

// Symbol for private method
const deliver = Symbol('__rsk.webhookDeliver__');

/**
 * Decision logic for whether to use background worker
 * @private
 * @param {Array} webhooks - Array of webhook objects
 * @param {Object} options - Decision options
 * @returns {Object} Decision result
 */
function makeSendDecision(webhooks, options = {}) {
  const thresholds = {
    batchThreshold: options.batchThreshold || 5,
    largePayloadThreshold: options.largePayloadThreshold || 100 * 1024, // 100KB
  };

  let useWorker = false;
  let reason = 'Simple webhook(s), main process sufficient';

  // Check if this is a batch operation
  if (webhooks.length >= thresholds.batchThreshold) {
    useWorker = true;
    reason = `Batch send (${webhooks.length} webhooks)`;
  }
  // Check for large payload in any webhook
  else if (
    webhooks.some(
      webhook =>
        webhook.payload &&
        JSON.stringify(webhook.payload).length >=
          thresholds.largePayloadThreshold,
    )
  ) {
    useWorker = true;
    reason = 'Large payload';
  }

  return { useWorker, reason };
}

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
 * Webhook Manager
 *
 * Manages webhook delivery with support for multiple adapters,
 * retry logic, and signature generation.
 */
class WebhookManager {
  constructor(config = {}) {
    this.adapters = new Map();
    this.defaultAdapter = config.adapter || 'memory';
    this.config = config;

    // Initialize default adapters
    this.initializeDefaultAdapters();
  }

  /**
   * Initialize default adapters
   * @private
   */
  initializeDefaultAdapters() {
    // Database adapter (default)
    this.adapters.set(
      'database',
      new DatabaseWebhookAdapter(this.config.database || {}),
    );

    // Always add memory adapter (for testing)
    this.adapters.set(
      'memory',
      new MemoryWebhookAdapter(this.config.memory || {}),
    );

    // HTTP adapter
    this.adapters.set('http', new HttpWebhookAdapter(this.config.http || {}));
  }

  /**
   * Add a custom adapter
   * @param {string} name - Adapter name
   * @param {Object} adapter - Adapter instance (must implement send method)
   * @returns {boolean} True if added, false if already exists
   */
  addAdapter(name, adapter) {
    if (this.adapters.has(name)) {
      console.warn(
        `Webhook adapter "${name}" already exists. Cannot override.`,
      );
      return false;
    }
    this.adapters.set(name, adapter);
    return true;
  }

  /**
   * Get an adapter by name
   * @param {string} name - Adapter name
   * @returns {Object|null} Adapter or null
   */
  getAdapter(name) {
    return this.adapters.get(name) || null;
  }

  /**
   * Set database connection for both adapter and worker
   * Automatically configures:
   * - DatabaseWebhookAdapter with the connection
   * - Worker pool for persist operations
   *
   * @param {Object} connection - Sequelize connection instance
   * @returns {boolean} True if connection was set
   *
   * @example
   * // Set DB connection once for both adapter and worker
   * webhook.setDbConnection(engines.db.connection);
   */
  setDbConnection(connection) {
    // Set connection on database adapter
    const dbAdapter = this.adapters.get('database');
    if (dbAdapter && dbAdapter.setConnection) {
      dbAdapter.setConnection(connection);
    }

    // Set connection on worker pool
    if (workerPool && workerPool.setDbConnection) {
      workerPool.setDbConnection(connection);
    }

    return true;
  }

  /**
   * Set connection factory for fork mode workers
   * @param {Function} factory - Function that returns a Sequelize connection
   */
  setConnectionFactory(factory) {
    if (workerPool && workerPool.setConnectionFactory) {
      workerPool.setConnectionFactory(factory);
    }
  }

  /**
   * Validate webhook data using Zod schema
   * @private
   * @param {Object|Array} webhooks - Webhook(s) to validate
   * @throws {WebhookValidationError} If validation fails
   */
  validate(webhooks) {
    const result = validateWebhook(webhooks);
    if (!result.success) {
      const errors = result.error.flatten();
      throw new WebhookValidationError(JSON.stringify(errors), 'data');
    }
  }

  async [deliver](payload, options = {}) {
    // Extract url for error reporting
    const url = payload && payload.url;

    try {
      // Get adapter
      const adapterName = options.adapter || this.defaultAdapter;
      const adapter = this.adapters.get(adapterName);

      if (!adapter) {
        throw new WebhookError(
          `Unknown adapter: ${adapterName}`,
          'ADAPTER_NOT_FOUND',
        );
      }

      const maxRetries =
        options.retries != null ? options.retries : DEFAULTS.MAX_RETRIES;
      let lastError = null;

      // Attempt delivery with retries
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await adapter.send(payload, options);
          return {
            ...result,
            attempts: attempt + 1,
          };
        } catch (error) {
          lastError = error;

          // Don't retry on validation errors
          if (error instanceof WebhookValidationError) {
            throw error;
          }

          // Retry if we have attempts left
          if (attempt < maxRetries) {
            const delay = getRetryDelay(attempt, options);
            await sleep(delay);
          }
        }
      }

      // All retries exhausted
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
    } catch (error) {
      if (error instanceof WebhookError) {
        return {
          success: false,
          status: WEBHOOK_STATUS.FAILED,
          url,
          error: {
            message: error.message,
            code: error.code,
          },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        status: WEBHOOK_STATUS.FAILED,
        url,
        error: {
          message: error.message,
          code: 'UNKNOWN_ERROR',
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Send webhook(s)
   * Handles single webhook or array of webhooks.
   *
   * @param {Object|Array} webhooks - Single webhook or array of webhooks
   * @param {string} webhooks.url - Destination URL (for single)
   * @param {Object} webhooks.payload - Payload (for single)
   * @param {Object} [options] - Send options
   * @param {string} [options.adapter] - Adapter to use (default: 'http')
   * @param {string} [options.secret] - Secret for signature generation
   * @param {string} [options.event] - Event type header
   * @param {number} [options.retries] - Max retry attempts (default: 3)
   * @param {number} [options.timeout] - Request timeout in ms
   * @param {number} [options.concurrency] - Concurrent requests for batch (default: 5)
   * @param {Object} [options.headers] - Additional headers
   * @returns {Promise<Object>} Delivery result
   *
   * @example
   * // Single webhook (object with url and payload)
   * await webhook.send({
   *   url: 'https://api.example.com/hook',
   *   payload: { event: 'user.created', data: { id: '123' } }
   * });
   *
   * @example
   * // With options
   * await webhook.send({
   *   url: 'https://api.example.com/hook',
   *   payload: { event: 'order.completed' }
   * }, {
   *   secret: 'my-secret',
   *   retries: 5,
   *   timeout: 10000
   * });
   *
   * @example
   * // Batch send (array)
   * await webhook.send([
   *   { url: 'https://a.com/hook', payload: { event: 'created' } },
   *   { url: 'https://b.com/hook', payload: { event: 'updated' } }
   * ]);
   */
  async send(webhooks, options = {}) {
    // Validate input using Zod
    try {
      this.validate(webhooks);
    } catch (error) {
      return {
        success: false,
        status: WEBHOOK_STATUS.FAILED,
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR',
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Normalize to array for decision making
    const webhookList = Array.isArray(webhooks) ? webhooks : [webhooks];

    // Use worker decision logic
    const decision = makeSendDecision(webhookList, options);

    // Determine worker usage:
    // - useWorker === true: Force worker
    // - useWorker === false: Force direct (bypass worker)
    // - useWorker === undefined: Auto-decide based on thresholds
    const shouldUseWorker =
      options.useWorker === true ||
      (options.useWorker !== false && decision.useWorker);

    if (shouldUseWorker) {
      return workerPool.processSend(webhooks, {
        ...options,
        forceFork: options.useWorker === true,
      });
    }

    // Handle array (batch) - direct processing
    if (Array.isArray(webhooks)) {
      const results = {
        successful: [],
        failed: [],
        total: webhooks.length,
      };

      // Execute in parallel with limit
      const concurrency = options.concurrency || 5;
      const chunks = [];

      for (let i = 0; i < webhooks.length; i += concurrency) {
        chunks.push(webhooks.slice(i, i + concurrency));
      }

      for (const chunk of chunks) {
        const promises = chunk.map(async webhook => {
          const webhookOptions = { ...options, ...webhook.options };
          const result = await this[deliver](webhook.payload, webhookOptions);

          if (result.success) {
            results.successful.push({
              url: webhook.payload.url,
              webhookId: result.webhookId,
              statusCode: result.statusCode,
            });
          } else {
            results.failed.push({
              url: webhook.payload.url,
              error: result.error,
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

    // Handle single webhook object
    if (webhooks && typeof webhooks === 'object') {
      return this[deliver](webhooks.payload, options);
    }

    // Invalid input
    return {
      success: false,
      status: WEBHOOK_STATUS.FAILED,
      error: {
        message: 'Invalid webhook input: expected object or array',
        code: 'VALIDATION_ERROR',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get statistics (from memory adapter)
   * @returns {Object} Stats
   */
  getStats() {
    const memoryAdapter = this.adapters.get('memory');
    return memoryAdapter ? memoryAdapter.getStats() : null;
  }
}

/**
 * Create a new isolated WebhookManager instance
 *
 * @param {Object} config - Configuration
 * @returns {WebhookManager} New manager instance
 */
export function createFactory(config = {}) {
  return new WebhookManager(config);
}
