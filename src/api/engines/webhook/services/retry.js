/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { WebhookError, createOperationResult } from '../errors';

/**
 * Retry a failed webhook
 * @param {Object} manager - WebhookManager instance (this)
 * @param {string} webhookId - Webhook ID
 * @param {Object} options - Retry options
 * @returns {Promise<Object>} Retry result
 */
export async function retry(manager, webhookId, _options = {}) {
  try {
    const dbAdapter = manager.getAdapter('database');
    if (!dbAdapter || !dbAdapter.hasConnection()) {
      throw new WebhookError(
        'Webhook database not configured',
        'DB_NOT_CONFIGURED',
      );
    }

    // Get the webhook record
    const record = await dbAdapter.getById(webhookId);
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

    // Re-send the webhook
    const result = await manager.send({
      payload: {
        url: record.url,
        event: record.event,
        ...record.payload,
      },
    });

    // Update the original record status
    await dbAdapter.updateStatus(webhookId, {
      success: result.success,
      statusCode: result.statusCode,
      attempts: record.attempts + 1,
    });

    return createOperationResult(
      true,
      {
        webhookId,
        success: result.success,
        statusCode: result.statusCode,
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
