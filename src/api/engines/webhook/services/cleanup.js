/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { WebhookError, createOperationResult } from '../errors';

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
    const { olderThan = 30, status } = options;

    const dbAdapter = manager.getAdapter('database');
    if (!dbAdapter || !dbAdapter.hasConnection()) {
      throw new WebhookError(
        'Webhook database not configured',
        'DB_NOT_CONFIGURED',
      );
    }

    const deleted = await dbAdapter.cleanup({
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
