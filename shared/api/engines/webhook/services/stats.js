/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { WebhookError, createOperationResult } from '../errors';

/**
 * Get webhook statistics
 * @param {Object} manager - WebhookManager instance (this)
 * @param {Object} options - Options
 * @returns {Promise<Object>} Statistics result
 */
export async function stats(manager, options = {}) {
  try {
    const { adapter: adapterName = 'database' } = options;

    const storageAdapter = manager.getAdapter(adapterName);
    if (!storageAdapter) {
      throw new WebhookError(
        `Adapter '${adapterName}' not configured`,
        'ADAPTER_NOT_CONFIGURED',
      );
    }

    // Check if adapter supports getStats
    if (!storageAdapter.getStats) {
      throw new WebhookError(
        `Adapter '${adapterName}' does not support stats operation`,
        'ADAPTER_NOT_SUPPORTED',
      );
    }

    const result = await storageAdapter.getStats();

    return createOperationResult(
      true,
      { stats: result },
      'Statistics retrieved',
    );
  } catch (error) {
    if (error instanceof WebhookError) {
      return createOperationResult(false, null, error.message, error);
    }
    return createOperationResult(
      false,
      null,
      'Get statistics failed',
      new WebhookError(error.message, 'STATS_FAILED'),
    );
  }
}

/**
 * Get webhooks pending retry
 * @param {Object} manager - WebhookManager instance (this)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Pending webhooks result
 */
export async function pending(manager, options = {}) {
  try {
    const { adapter: adapterName = 'database', limit = 50 } = options;

    const storageAdapter = manager.getAdapter(adapterName);
    if (!storageAdapter) {
      throw new WebhookError(
        `Adapter '${adapterName}' not configured`,
        'ADAPTER_NOT_CONFIGURED',
      );
    }

    // Check if adapter supports getPendingRetries
    if (!storageAdapter.getPendingRetries) {
      throw new WebhookError(
        `Adapter '${adapterName}' does not support pending operation`,
        'ADAPTER_NOT_SUPPORTED',
      );
    }

    const webhooks = await storageAdapter.getPendingRetries({ limit });

    return createOperationResult(
      true,
      {
        webhooks,
        count: webhooks.length,
      },
      `Found ${webhooks.length} pending webhooks`,
    );
  } catch (error) {
    if (error instanceof WebhookError) {
      return createOperationResult(false, null, error.message, error);
    }
    return createOperationResult(
      false,
      null,
      'Get pending webhooks failed',
      new WebhookError(error.message, 'PENDING_FAILED'),
    );
  }
}
