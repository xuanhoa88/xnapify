/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Database Persist Worker - Handles webhook persistence to database
 * Focuses only on database operations: store, update status, cleanup.
 */

import { createWorkerHandler, setupWorkerProcess } from '../../worker';
import { WebhookError } from '../errors';
import { DatabaseWebhookAdapter } from '../adapters';

// Database adapter instance
let dbAdapter = null;
let connectionFactory = null;

/**
 * Get database adapter for worker
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

  if (!dbAdapter.hasConnection()) {
    return null;
  }

  return dbAdapter;
}

/**
 * Ensure adapter is available
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
 */
export function setDbConnection(connection) {
  if (!dbAdapter) {
    dbAdapter = new DatabaseWebhookAdapter();
  }
  dbAdapter.setConnection(connection);
}

/**
 * Set connection factory for lazy initialization
 */
export function setConnectionFactory(factory) {
  connectionFactory = factory;
}

/**
 * Store webhooks in batch
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
      const result = await adapter.send(webhook, {
        ...options,
        ...webhook.options,
      });

      if (result.success) {
        results.stored.push({
          webhookId: result.webhookId,
        });
      } else {
        results.failed.push({
          error: result.error,
        });
      }
    } catch (error) {
      results.failed.push({
        error: { message: error.message, code: error.code || 'STORE_ERROR' },
      });
    }
  }

  return results;
}

/**
 * Update webhook statuses in batch
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
 * Process database operations
 */
async function processPersist(data) {
  const { operation, ...params } = data;

  switch (operation) {
    case 'store':
      return storeWebhooks(params.webhooks, params.options);

    case 'updateStatus':
      return updateStatuses(params.updates);

    case 'cleanup': {
      const adapter = requireAdapter();
      const deleted = await adapter.cleanup(params.options);
      return { deleted, success: true };
    }

    case 'getStats': {
      const adapter = requireAdapter();
      const stats = await adapter.getStats();
      return { stats, success: true };
    }

    default:
      throw new WebhookError(
        `Unknown operation: ${operation}`,
        'INVALID_OPERATION',
        400,
      );
  }
}

// Create worker function
const workerFunction = createWorkerHandler(processPersist, 'PERSIST_WEBHOOK');

// Export for same-process execution
export default workerFunction;

// Setup fork mode execution
setupWorkerProcess(processPersist, 'PERSIST_WEBHOOK', 'Webhook Database');
