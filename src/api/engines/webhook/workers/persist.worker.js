/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Database Persist Worker - Handles webhook persistence to database
 * Focuses only on database operations: store, update status, cleanup.
 * No HTTP logic - this is a pure database worker.
 *
 * Note: Database connection must be set externally via setDbConnection()
 * or setConnectionFactory(). The worker does not auto-connect.
 */

import { createWorkerHandler, setupWorkerProcess } from '../../worker';
import { WebhookError } from '../errors';
import { DatabaseWebhookAdapter } from '../adapters';

// Database adapter instance (connection set externally)
let dbAdapter = null;
let connectionFactory = null;

/**
 * Get database adapter for worker
 * Returns null if no connection is configured
 * @private
 */
function getDbAdapter() {
  if (!dbAdapter) {
    dbAdapter = new DatabaseWebhookAdapter();
  }

  // If no connection, try using connection factory
  if (!dbAdapter.hasConnection() && connectionFactory) {
    try {
      const connection = connectionFactory();
      dbAdapter.setConnection(connection);
    } catch (error) {
      console.warn('Failed to create database connection:', error.message);
      return null;
    }
  }

  // If still no connection, return null
  if (!dbAdapter.hasConnection()) {
    return null;
  }

  return dbAdapter;
}

/**
 * Ensure adapter is available, throw if not
 * @private
 */
function requireAdapter() {
  const adapter = getDbAdapter();
  if (!adapter) {
    throw new WebhookError(
      'Database connection not configured',
      'NO_CONNECTION',
      500,
    );
  }
  return adapter;
}

/**
 * Set database connection from main process
 * @param {Object} connection - Sequelize connection
 */
export function setDbConnection(connection) {
  if (!dbAdapter) {
    dbAdapter = new DatabaseWebhookAdapter();
  }
  dbAdapter.setConnection(connection);
}

/**
 * Set connection factory for fork mode
 * @param {Function} factory - Function that returns a Sequelize connection
 */
export function setConnectionFactory(factory) {
  connectionFactory = factory;
}

/**
 * Store webhooks to database with pending status
 * @private
 */
async function storeWebhooks(webhooks, options = {}) {
  const adapter = requireAdapter();

  const results = {
    stored: [],
    failed: [],
    total: webhooks.length,
  };

  for (const webhook of webhooks) {
    try {
      const result = await adapter.send(webhook.payload, {
        ...options,
        ...webhook.options,
      });

      if (result.success) {
        results.stored.push({
          webhookId: result.webhookId,
          url: webhook.payload.url,
        });
      } else {
        results.failed.push({
          url: webhook.payload.url,
          error: result.error,
        });
      }
    } catch (error) {
      results.failed.push({
        url: webhook.payload.url,
        error: { message: error.message, code: error.code || 'STORE_ERROR' },
      });
    }
  }

  return results;
}

/**
 * Update webhook statuses in batch
 * @private
 */
async function updateStatuses(updates) {
  const adapter = requireAdapter();

  const results = {
    updated: [],
    failed: [],
    total: updates.length,
  };

  for (const update of updates) {
    try {
      const record = await adapter.updateStatus(
        update.webhookId,
        update.result,
      );
      if (record) {
        results.updated.push({ webhookId: update.webhookId });
      } else {
        results.failed.push({
          webhookId: update.webhookId,
          error: { message: 'Webhook not found', code: 'NOT_FOUND' },
        });
      }
    } catch (error) {
      results.failed.push({
        webhookId: update.webhookId,
        error: { message: error.message, code: error.code || 'UPDATE_ERROR' },
      });
    }
  }

  return results;
}

/**
 * Get pending webhooks
 * @private
 */
async function getPendingWebhooks(options) {
  const adapter = requireAdapter();
  const pending = await adapter.getPendingRetries(options);
  return {
    operation: 'GET_PENDING',
    webhooks: pending.map(w => w.toJSON()),
    count: pending.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Cleanup old webhooks
 * @private
 */
async function cleanupWebhooks(options) {
  const adapter = requireAdapter();
  const deleted = await adapter.cleanup(options);
  return {
    operation: 'CLEANUP',
    deleted,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get webhook stats
 * @private
 */
async function getWebhookStats() {
  const adapter = requireAdapter();
  const stats = await adapter.getStats();
  return {
    operation: 'GET_STATS',
    stats,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Process database persist operations
 * @param {Object} data - Operation data
 * @returns {Promise<Object>} Result
 */
async function processPersist(data) {
  const { operation, webhooks, updates, options = {} } = data;

  switch (operation) {
    case 'STORE':
      if (!webhooks || webhooks.length === 0) {
        throw new WebhookError(
          'At least one webhook is required for STORE',
          'INVALID_INPUT',
          400,
        );
      }
      return {
        operation: 'STORE',
        ...(await storeWebhooks(
          Array.isArray(webhooks) ? webhooks : [webhooks],
          options,
        )),
        timestamp: new Date().toISOString(),
      };

    case 'UPDATE_STATUS':
      if (!updates || updates.length === 0) {
        throw new WebhookError(
          'At least one update is required for UPDATE_STATUS',
          'INVALID_INPUT',
          400,
        );
      }
      return {
        operation: 'UPDATE_STATUS',
        ...(await updateStatuses(Array.isArray(updates) ? updates : [updates])),
        timestamp: new Date().toISOString(),
      };

    case 'GET_PENDING':
      return getPendingWebhooks(options);

    case 'CLEANUP':
      return cleanupWebhooks(options);

    case 'GET_STATS':
      return getWebhookStats();

    default:
      throw new WebhookError(
        `Unknown operation: ${operation}`,
        'INVALID_OPERATION',
        400,
      );
  }
}

// Create worker function using helper
const workerFunction = createWorkerHandler(processPersist, 'PERSIST_WEBHOOK');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupWorkerProcess(processPersist, 'PERSIST_WEBHOOK', 'Webhook DB');
