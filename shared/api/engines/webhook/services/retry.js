/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { WebhookError, createOperationResult } from '../errors';
import workerPool from '../workers';

/**
 * Retry a failed webhook
 * @param {Object} manager - WebhookManager instance (this)
 * @param {string} webhookId - Webhook ID
 * @param {Object} options - Retry options
 * @returns {Promise<Object>} Retry result
 */
export async function retry(manager, webhookId, options = {}) {
  try {
    const { adapter: adapterName = 'database', useWorker = true } = options;
    const storageAdapter = manager.getAdapter(adapterName);

    if (!storageAdapter) {
      throw new WebhookError(
        `Adapter '${adapterName}' not configured`,
        'ADAPTER_NOT_CONFIGURED',
      );
    }

    // Check if adapter supports required methods
    if (!storageAdapter.getById || !storageAdapter.updateStatus) {
      throw new WebhookError(
        `Adapter '${adapterName}' does not support retry operations`,
        'ADAPTER_NOT_SUPPORTED',
      );
    }

    // Get the webhook record (Always direct read for consistency)
    const record = await storageAdapter.getById(webhookId);
    if (!record) {
      throw new WebhookError('Webhook not found', 'NOT_FOUND');
    }

    // Only retry failed webhooks
    if (record.status !== 'failed') {
      throw new WebhookError(
        `Cannot retry webhook with status: ${record.status}`,
        'INVALID_STATUS',
      );
    }

    // Re-send the webhook using new API
    // Pass useWorker option so manager decides whether to use send worker
    const result = await manager.send(
      {
        event: record.event,
        ...record.payload,
      },
      {
        adapter: 'http',
        useWorker,
      },
    );

    // Update the original record status
    if (useWorker !== false) {
      // Offload status update to worker
      await workerPool.processPersist({
        operation: 'updateStatus',
        updates: [
          {
            webhookId,
            result: {
              success: result.success,
              attempts: record.attempts + 1,
            },
          },
        ],
      });
    } else {
      // Direct update
      await storageAdapter.updateStatus(webhookId, {
        success: result.success,
        attempts: record.attempts + 1,
      });
    }

    return createOperationResult(
      true,
      {
        webhookId,
        success: result.success,
      },
      result.success ? 'Webhook retry successful' : 'Webhook retry failed',
    );
  } catch (error) {
    if (error instanceof WebhookError) {
      return createOperationResult(false, null, error.message, error);
    }
    return createOperationResult(
      false,
      null,
      'Retry webhook failed',
      new WebhookError(error.message, 'RETRY_FAILED'),
    );
  }
}
