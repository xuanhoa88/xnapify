/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { WebhookError, createOperationResult } from '../errors';
import workerPool from '../workers';

/**
 * Cleanup old webhooks
 * @param {Object} manager - WebhookManager instance (this)
 * @param {Object} options - Cleanup options
 * @param {number} options.olderThan - Delete webhooks older than N days (default: 30)
 * @param {string} options.status - Optional status filter
 * @returns {Promise<Object>} Cleanup result
 */
export async function cleanup(manager, options = {}) {
  try {
    const {
      olderThan = 30,
      status,
      useWorker = true,
      adapter = 'database',
    } = options;

    // 1. Worker Execution (Default)
    if (useWorker !== false) {
      const result = await workerPool.processPersist({
        operation: 'cleanup',
        options: {
          olderThan,
          status,
        },
      });

      if (!result.success) {
        throw new Error(result.error || 'Cleanup failed');
      }

      return createOperationResult(
        true,
        { deleted: result.deleted },
        `Deleted ${result.deleted} old webhook(s)`,
      );
    }

    // 2. Direct Execution (Main Process)
    const storageAdapter = manager.getAdapter(adapter);
    if (!storageAdapter) {
      throw new WebhookError(
        `Adapter '${adapter}' not configured`,
        'ADAPTER_NOT_CONFIGURED',
      );
    }

    if (!storageAdapter.cleanup) {
      throw new WebhookError(
        `Adapter '${adapter}' does not support cleanup operation`,
        'ADAPTER_NOT_SUPPORTED',
      );
    }

    const deleted = await storageAdapter.cleanup({
      olderThan,
      status,
    });

    return createOperationResult(
      true,
      { deleted },
      `Deleted ${deleted} old webhook(s)`,
    );
  } catch (error) {
    if (error instanceof WebhookError) {
      return createOperationResult(false, null, error.message, error);
    }
    return createOperationResult(
      false,
      null,
      'Cleanup webhooks failed',
      new WebhookError(error.message, 'CLEANUP_FAILED'),
    );
  }
}
