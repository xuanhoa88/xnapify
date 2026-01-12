/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Webhook Worker Pool - Manages webhook operations
 * Uses the shared worker engine for worker pool management
 *
 * Workers:
 * - `send` (HTTP): Delivers webhooks via HTTP with retry support
 * - `persist` (Database): Stores/updates webhooks in database
 *
 * These workers are independent and can be used separately or together.
 */

import { createWorkerPool } from '../../worker';
import { WebhookWorkerError } from '../errors';
import {
  setDbConnection as setPersistDbConnection,
  setConnectionFactory as setPersistConnectionFactory,
} from './persist.worker';

// Worker configuration
const WORKER_CONFIG = Object.freeze({
  maxWorkers: parseInt(process.env.RSK_WEBHOOK_MAX_WORKERS, 10) || 4,
  workerTimeout: parseInt(process.env.RSK_WEBHOOK_WORKER_TIMEOUT, 10) || 60000,
  maxRequestsPerWorker:
    parseInt(process.env.RSK_WEBHOOK_MAX_REQUESTS_PER_WORKER, 10) || 100,
});

// Use require.context to dynamically import worker files
const workersContext = require.context('./', false, /\.worker\.js$/);

// Create worker pool with webhook-specific configuration
const workerPool = createWorkerPool(workersContext, {
  ErrorHandler: WebhookWorkerError,
  engineName: '🪝 Webhook',
  maxWorkers: WORKER_CONFIG.maxWorkers,
  workerTimeout: WORKER_CONFIG.workerTimeout,
  maxRequestsPerWorker: WORKER_CONFIG.maxRequestsPerWorker,
});

// ==========================================================================
// DATABASE CONNECTION SETUP (for persist worker)
// ==========================================================================

/**
 * Set the database connection for the persist worker
 * Required for same-process execution
 *
 * @param {Object} connection - Sequelize connection instance
 */
workerPool.setDbConnection = function setConnection(connection) {
  setPersistDbConnection(connection);
};

/**
 * Set a connection factory for fork mode
 *
 * @param {Function} factory - Function that returns a Sequelize connection
 */
workerPool.setConnectionFactory = function setFactory(factory) {
  setPersistConnectionFactory(factory);
};

// ==========================================================================
// HTTP SEND OPERATIONS (send.worker.js)
// ==========================================================================

/**
 * Send webhooks via HTTP (no database)
 * Uses the HTTP-only send worker
 *
 * @param {Array|Object} webhooks - Webhook(s) to send
 * @param {Object} options - Send options
 * @param {boolean} [options.forceFork] - Force fork mode
 * @param {number} [options.concurrency=5] - Max concurrent requests
 * @param {number} [options.retries] - Max retries per webhook
 * @returns {Promise<Object>} Send result
 *
 * @example
 * const result = await workerPool.processSend([
 *   { url: 'https://api.example.com/hook', payload: { event: 'created' } }
 * ]);
 */
workerPool.processSend = async function processSend(webhooks, options = {}) {
  const { forceFork, ...sendOptions } = options;
  return await this.sendRequest(
    'send',
    'SEND_WEBHOOK',
    {
      type: 'SEND_WEBHOOK',
      webhooks,
      options: sendOptions,
    },
    { forceFork },
  );
};

// ==========================================================================
// DATABASE PERSIST OPERATIONS (persist.worker.js)
// ==========================================================================

/**
 * Store webhooks to database with pending status
 *
 * @param {Array|Object} webhooks - Webhook(s) to store
 * @param {Object} options - Store options
 * @returns {Promise<Object>} Store result
 *
 * @example
 * const result = await workerPool.processStore([
 *   { url: 'https://api.example.com/hook', payload: { event: 'created' } }
 * ]);
 */
workerPool.processStore = async function processStore(webhooks, options = {}) {
  const { forceFork, ...storeOptions } = options;
  return await this.sendRequest(
    'persist',
    'PERSIST_WEBHOOK',
    {
      type: 'PERSIST_WEBHOOK',
      operation: 'STORE',
      webhooks,
      options: storeOptions,
    },
    { forceFork },
  );
};

/**
 * Update webhook statuses in database
 *
 * @param {Array|Object} updates - Status update(s)
 * @param {Object} options - Update options
 * @returns {Promise<Object>} Update result
 *
 * @example
 * await workerPool.processUpdateStatus([
 *   { webhookId: 'uuid', result: { success: true, statusCode: 200 } }
 * ]);
 */
workerPool.processUpdateStatus = async function processUpdateStatus(
  updates,
  options = {},
) {
  const { forceFork } = options;
  return await this.sendRequest(
    'persist',
    'PERSIST_WEBHOOK',
    {
      type: 'PERSIST_WEBHOOK',
      operation: 'UPDATE_STATUS',
      updates,
    },
    { forceFork },
  );
};

/**
 * Get webhooks pending retry from database
 *
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Pending webhooks
 */
workerPool.processGetPending = async function processGetPending(options = {}) {
  const { forceFork, ...queryOptions } = options;
  return await this.sendRequest(
    'persist',
    'PERSIST_WEBHOOK',
    {
      type: 'PERSIST_WEBHOOK',
      operation: 'GET_PENDING',
      options: queryOptions,
    },
    { forceFork },
  );
};

/**
 * Cleanup old webhooks from database
 *
 * @param {Object} options - Cleanup options
 * @returns {Promise<Object>} Cleanup result
 */
workerPool.processCleanup = async function processCleanup(options = {}) {
  const { forceFork, ...cleanupOptions } = options;
  return await this.sendRequest(
    'persist',
    'PERSIST_WEBHOOK',
    {
      type: 'PERSIST_WEBHOOK',
      operation: 'CLEANUP',
      options: cleanupOptions,
    },
    { forceFork },
  );
};

/**
 * Get webhook statistics from database
 *
 * @param {Object} options - Options
 * @returns {Promise<Object>} Stats
 */
workerPool.processGetStats = async function processGetStats(options = {}) {
  const { forceFork } = options;
  return await this.sendRequest(
    'persist',
    'PERSIST_WEBHOOK',
    {
      type: 'PERSIST_WEBHOOK',
      operation: 'GET_STATS',
    },
    { forceFork },
  );
};

// ==========================================================================
// COMBINED OPERATIONS (convenience methods)
// ==========================================================================

/**
 * Send webhooks with database tracking
 * Pattern: Store → Send → Update Status
 *
 * @param {Array|Object} webhooks - Webhook(s) to send
 * @param {Object} options - Options
 * @returns {Promise<Object>} Combined result
 */
workerPool.processSendWithDb = async function processSendWithDb(
  webhooks,
  options = {},
) {
  const webhookList = Array.isArray(webhooks) ? webhooks : [webhooks];

  // Step 1: Store in database
  const storeResult = await this.processStore(webhookList, options);

  // Step 2: Send via HTTP (map stored webhooks)
  const sendResult = await this.processSend(webhookList, options);

  // Step 3: Update statuses based on send results
  const updates = [];

  sendResult.successful.forEach(s => {
    const stored = storeResult.stored.find(st => st.url === s.url);
    if (stored) {
      updates.push({
        webhookId: stored.webhookId,
        result: {
          success: true,
          statusCode: s.statusCode,
          attempts: s.attempts,
        },
      });
    }
  });

  sendResult.failed.forEach(f => {
    const stored = storeResult.stored.find(st => st.url === f.url);
    if (stored) {
      updates.push({
        webhookId: stored.webhookId,
        result: {
          success: false,
          attempts: f.attempts,
          error: f.error,
        },
      });
    }
  });

  if (updates.length > 0) {
    await this.processUpdateStatus(updates, options);
  }

  return {
    store: storeResult,
    send: sendResult,
    timestamp: new Date().toISOString(),
  };
};

// ==========================================================================
// UNREGISTER METHODS
// ==========================================================================

/**
 * Unregister the send worker
 * @returns {boolean} True if unregistered
 */
workerPool.unregisterSend = function unregisterSend() {
  return this.unregisterWorker('send');
};

/**
 * Unregister the persist worker
 * @returns {boolean} True if unregistered
 */
workerPool.unregisterPersist = function unregisterPersist() {
  return this.unregisterWorker('persist');
};

// =============================================================================
// EXPORTS
// =============================================================================

export default workerPool;
