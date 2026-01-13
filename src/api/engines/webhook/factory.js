/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';
import {
  HttpWebhookAdapter,
  MemoryWebhookAdapter,
  DatabaseWebhookAdapter,
} from './adapters';
import { WebhookError, WebhookValidationError } from './errors';
import { DEFAULTS, WEBHOOK_STATUS } from './utils/constants';
import workerPool, {
  setPersistDbConnection,
  setPersistConnectionFactory,
} from './workers';

// Webhook validation schema (accepts any data - validation at adapter level)
const sendWebhookSchema = z.any();

// Symbol for private method
const DELIVER = Symbol('__rsk.webhookDeliver__');

/**
 * Decision logic for whether to use background worker
 * @private
 * @param {any} data - Data to send
 * @param {Object} options - Decision options
 * @returns {Object} Decision result
 */
function makeSendDecision(data, options = {}) {
  const thresholds = {
    largePayloadThreshold: options.largePayloadThreshold || 100 * 1024, // 100KB
  };

  let useWorker = false;
  let reason = 'Simple data, main process sufficient';

  // Check for large payload
  try {
    const dataSize = JSON.stringify(data).length;
    if (dataSize >= thresholds.largePayloadThreshold) {
      useWorker = true;
      reason = `Large payload (${Math.round(dataSize / 1024)}KB)`;
    }
  } catch (error) {
    // If data can't be serialized, don't use worker
    reason = 'Data serialization error, using main process';
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

    // Workers are initialized automatically by the worker pool
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

    // Set connection on worker
    setPersistDbConnection(connection);

    return true;
  }

  /**
   * Set connection factory for fork mode workers
   * @param {Function} factory - Function that returns a Sequelize connection
   */
  setConnectionFactory(factory) {
    setPersistConnectionFactory(factory);
  }

  /**
   * Validate webhook data using Zod schema
   * @private
   * @param {any} data - Data to validate
   * @throws {WebhookValidationError} If validation fails
   */
  validate(data) {
    const result = sendWebhookSchema.safeParse(data);
    if (!result.success) {
      const errors = result.error.flatten();
      throw new WebhookValidationError(JSON.stringify(errors), 'data');
    }
  }

  async [DELIVER](data, options = {}) {
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
          const result = await adapter.send(data, options);
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
        error: {
          message: error.message,
          code: 'UNKNOWN_ERROR',
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Send webhook data
   *
   * @param {any} data - Data to send (any type)
   * @param {Object} [options] - Send options
   * @param {string} [options.adapter] - Adapter to use (default: 'database')
   * @param {string} [options.url] - URL for HTTP adapter
   * @param {string} [options.secret] - Secret for signature generation
   * @param {string} [options.event] - Event type header
   * @param {number} [options.retries] - Max retry attempts (default: 3)
   * @param {number} [options.timeout] - Request timeout in ms
   * @returns {Promise<Object>} Delivery result
   *
   * @example
   * // Send data with HTTP adapter
   * await webhook.send({ event: 'user.created', data: { id: '123' } }, {
   *   adapter: 'http',
   *   url: 'https://api.example.com/hook'
   * });
   *
   * @example
   * // Send data with database adapter (stores for later delivery)
   * await webhook.send({ event: 'order.completed', data: {...} });
   */
  async send(data, options = {}) {
    // Validate input using Zod
    try {
      this.validate(data);
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

    // Use worker decision logic
    const decision = makeSendDecision(data, options);

    // Determine worker usage:
    // - useWorker === true: Force worker
    // - useWorker === false: Force direct (bypass worker)
    // - useWorker === undefined: Auto-decide based on thresholds
    const shouldUseWorker =
      options.useWorker === true ||
      (options.useWorker !== false && decision.useWorker);

    if (shouldUseWorker) {
      const adapterName = options.adapter || this.defaultAdapter;

      try {
        if (adapterName === 'http') {
          return workerPool.processSend([data], options);
        }
        if (adapterName === 'database') {
          return workerPool.processPersist({
            operation: 'store',
            webhooks: [data],
            options,
          });
        }
      } catch (error) {
        // Fallback to direct delivery if worker fails or not initialized
        console.warn(
          `Worker delivery failed for adapter ${adapterName}, falling back to main process:`,
          error.message,
        );
      }
    }

    // Direct processing - pass data to adapter
    return this[DELIVER](data, options);
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
