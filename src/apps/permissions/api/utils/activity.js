/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Log an activity
 *
 * @param {Object} webhook - Webhook engine instance
 * @param {Object} activity - Activity data
 * @param {string} activity.event - Event type
 * @param {string} activity.entityType - Entity type
 * @param {string} activity.entityId - Entity ID
 * @param {string} activity.action - Action performed
 * @param {Object} activity.data - Additional activity data
 * @param {string} [activity.actorId] - ID of user performing the action
 * @param {Object} [options] - Additional send options
 * @returns {Promise<Object|null>} Activity result or null if webhook unavailable
 */
export async function logActivity(webhook, activity, options = {}) {
  try {
    if (!webhook) {
      console.warn('Activity Logger: No webhook manager instance provided');
      return null;
    }

    const {
      event,
      entityType,
      entityId,
      actorId = null,
      ...payload
    } = activity;

    const result = await webhook.send(
      {
        ...payload,
        event,
        status: 'delivered',
        entity_type: entityType,
        entity_id: entityId,
        actor_id: actorId,
        timestamp: new Date().toISOString(),
        type: 'user_activity',
      },
      {
        adapter: 'database',
        ...options,
      },
    );

    if (!result.success) {
      console.error(
        'Activity Logger: Failed to store activity',
        JSON.stringify(result.error),
      );
    }

    return result;
  } catch (error) {
    console.error('Failed to log activity:', error.message);
    console.error(error.stack);
    return null;
  }
}

/**
 * Log permission entity activity
 *
 * @param {Object} webhook - Webhook engine instance
 * @param {string} action - Action (created, updated, deleted)
 * @param {string} permissionId - Permission ID
 * @param {Object} data - Additional data
 * @param {string} [actorId] - ID of user performing the action
 * @param {Object} [options] - Additional send options
 */
export function logPermissionActivity(
  webhook,
  action,
  permissionId,
  data = {},
  actorId,
  options = {},
) {
  return logActivity(
    webhook,
    {
      ...data,
      event: `permission.${action}`,
      entityType: 'permission',
      entityId: permissionId,
      action,
      actorId,
    },
    options,
  );
}
