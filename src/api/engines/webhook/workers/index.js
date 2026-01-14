/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Webhook Worker Pool - Manages webhook operations
 * Uses the shared worker engine for worker pool management
 */

import { createWorkerPool } from '../../worker';
import { WebhookError } from '../errors';

// Auto-load workers via webpack require.context (*.worker.js)
const workersContext = require.context('./', false, /\.worker\.js$/);

// Worker configuration (can be overridden by options)
const DEFAULT_CONFIG = {
  maxWorkers: 2,
  poolSize: 2,
};

// Create worker pool with webhook-specific configuration
const workerPool = createWorkerPool(workersContext, {
  ErrorHandler: WebhookError,
  engineName: 'Webhook',
  maxWorkers: DEFAULT_CONFIG.maxWorkers,
});

// ==========================================================================
// HIGH-LEVEL WEBHOOK OPERATIONS
// ==========================================================================

/**
 * Process HTTP send operations
 * @param {Array|Object} webhooks - Webhooks to send
 * @param {Object} options - Send options
 * @returns {Promise<Object>} Send result
 */
workerPool.processSend = async function processSend(webhooks, options = {}) {
  return await this.sendRequest('send', 'SEND_WEBHOOK', {
    webhooks,
    options,
  });
};

/**
 * Process database persist operations
 * @param {Object} data - Persist data
 * @returns {Promise<Object>} Persist result
 */
workerPool.processPersist = async function processPersist(data) {
  return await this.sendRequest('persist', 'PERSIST_WEBHOOK', data);
};

/**
 * Combined process: Store -> Send -> Update Status
 * Use this for high-reliability webhook delivery
 * @param {Array} webhooks - Webhooks to process
 * @param {Object} options - Options
 */
workerPool.processSendWithDb = async function processSendWithDb(
  webhooks,
  options = {},
) {
  // 1. Store webhooks (PENDING status)
  const storeResult = await this.sendRequest('persist', 'PERSIST_WEBHOOK', {
    operation: 'store',
    webhooks,
    options,
  });

  if (
    !storeResult.success &&
    (!storeResult.stored || storeResult.stored.length === 0)
  ) {
    return {
      success: false,
      error: 'Failed to persist webhooks',
      details: storeResult.failed,
    };
  }

  // 2. Map stored IDs back to payloads for sending
  const webhooksToSend = webhooks
    .map((hook, index) => {
      const stored = storeResult.stored[index];
      if (stored) {
        return { ...hook, id: stored.webhookId };
      }
      return null;
    })
    .filter(Boolean);

  if (webhooksToSend.length === 0) {
    return { success: false, error: 'No webhooks were stored successfully' };
  }

  // 3. Send via HTTP
  const sendResult = await this.sendRequest('send', 'SEND_WEBHOOK', {
    webhooks: webhooksToSend,
    options,
  });

  // 4. Prepare status updates
  const updates = [];

  if (sendResult.successful) {
    sendResult.successful.forEach(res => {
      updates.push({
        webhookId: res.webhookId,
        result: { success: true, attempts: res.attempts },
      });
    });
  }

  if (sendResult.failed) {
    sendResult.failed.forEach(res => {
      if (res.webhookId) {
        updates.push({
          webhookId: res.webhookId,
          result: { success: false, attempts: res.attempts },
        });
      }
    });
  }

  // 5. Update statuses
  if (updates.length > 0) {
    await this.sendRequest('persist', 'PERSIST_WEBHOOK', {
      operation: 'updateStatus',
      updates,
    });
  }

  return {
    success: true,
    stored: storeResult.stored.length,
    sent: sendResult.successful.length,
    failed: sendResult.failed.length,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Unregister the send worker
 */
workerPool.unregisterSend = function unregisterSend() {
  return this.unregisterWorker('send');
};

/**
 * Unregister the persist worker
 */
workerPool.unregisterPersist = function unregisterPersist() {
  return this.unregisterWorker('persist');
};

// =============================================================================
// RE-EXPORTS (for compatibility and direct access)
// =============================================================================

export {
  setDbConnection as setPersistDbConnection,
  setConnectionFactory as setPersistConnectionFactory,
} from './persist.worker';

export default workerPool;
