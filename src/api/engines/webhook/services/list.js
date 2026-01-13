/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { WebhookError, createOperationResult } from '../errors';

/**
 * Get webhooks with filters and pagination
 * @param {Object} manager - WebhookManager instance (this)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Webhooks result with pagination
 */
export async function list(manager, options = {}) {
  try {
    const {
      adapter: adapterName = 'database',
      status,
      event,
      fromDate,
      toDate,
      limit = 20,
      offset = 0,
    } = options;

    const storageAdapter = manager.getAdapter(adapterName);
    if (!storageAdapter) {
      throw new WebhookError(
        `Adapter '${adapterName}' not configured`,
        'ADAPTER_NOT_CONFIGURED',
      );
    }

    // Check if adapter supports getWebhooks
    if (!storageAdapter.getWebhooks) {
      throw new WebhookError(
        `Adapter '${adapterName}' does not support list operations`,
        'ADAPTER_NOT_SUPPORTED',
      );
    }

    const result = await storageAdapter.getWebhooks({
      status,
      event,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit,
      offset,
    });

    return createOperationResult(
      true,
      {
        webhooks: result.data,
        total: result.total,
      },
      `Retrieved ${result.data.length} webhooks`,
    );
  } catch (error) {
    if (error instanceof WebhookError) {
      return createOperationResult(false, null, error.message, error);
    }
    return createOperationResult(
      false,
      null,
      'List webhooks failed',
      new WebhookError(error.message, 'LIST_FAILED'),
    );
  }
}

/**
 * Get webhook by ID
 * @param {Object} manager - WebhookManager instance (this)
 * @param {string} webhookId - Webhook ID
 * @param {Object} options - Options
 * @returns {Promise<Object>} Webhook result
 */
export async function getById(manager, webhookId, options = {}) {
  try {
    const { adapter: adapterName = 'database' } = options;

    const storageAdapter = manager.getAdapter(adapterName);
    if (!storageAdapter) {
      throw new WebhookError(
        `Adapter '${adapterName}' not configured`,
        'ADAPTER_NOT_CONFIGURED',
      );
    }

    // Check if adapter supports getById
    if (!storageAdapter.getById) {
      throw new WebhookError(
        `Adapter '${adapterName}' does not support getById operation`,
        'ADAPTER_NOT_SUPPORTED',
      );
    }

    const record = await storageAdapter.getById(webhookId);
    if (!record) {
      throw new WebhookError('Webhook not found', 'NOT_FOUND');
    }

    return createOperationResult(
      true,
      { webhook: record },
      'Webhook retrieved',
    );
  } catch (error) {
    if (error instanceof WebhookError) {
      return createOperationResult(false, null, error.message, error);
    }
    return createOperationResult(
      false,
      null,
      'Get webhook failed',
      new WebhookError(error.message, 'GET_FAILED'),
    );
  }
}
