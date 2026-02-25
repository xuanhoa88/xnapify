/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * User Activity Logger
 *
 * Utility for logging user activities using the webhook database adapter.
 * Stores activities as webhook records for centralized tracking.
 */

/**
 * Log a user activity
 *
 * @param {Object} webhook - Webhook engine instance
 * @param {Object} activity - Activity data
 * @param {string} activity.event - Event type (e.g., 'user.created', 'role.updated')
 * @param {string} activity.entityType - Entity type (user, group, role, permission)
 * @param {string} activity.entityId - Entity ID
 * @param {string} activity.action - Action performed (create, update, delete)
 * @param {Object} activity.data - Additional activity data
 * @param {string} [activity.actorId] - ID of user performing the action
 * @param {Object} [options] - Additional send options (e.g. { useWorker: true })
 * @returns {Promise<Object|null>} Activity result or null if webhook unavailable
 */
export async function logActivity(webhook, activity, options = {}) {
  try {
    // webhook is now the instance directly (no longer the module namespace)
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

    // Use webhook.send to allow for worker processing if configured
    const result = await webhook.send(
      {
        ...payload,
        event,
        status: 'delivered', // Activity logs are audit records, not webhooks to send
        entity_type: entityType,
        entity_id: entityId,
        actor_id: actorId,
        timestamp: new Date().toISOString(),
        type: 'user_activity',
      },
      {
        adapter: 'database',
        ...options, // Pass through options like useWorker
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
    // Silently fail - activity logging should never block auth operations
    console.error('Failed to log activity:', error.message);
    console.error(error.stack);
    return null;
  }
}

/**
 * Log user entity activity
 *
 * @param {Object} webhook - Webhook engine instance
 * @param {string} action - Action (created, updated, deleted)
 * @param {string} userId - User ID
 * @param {Object} data - Additional data
 * @param {Object} [options] - Additional send options
 */
export function logUserActivity(
  webhook,
  action,
  userId,
  data = {},
  actorId,
  options = {},
) {
  return logActivity(
    webhook,
    {
      ...data,
      event: `user.${action}`,
      entityType: 'user',
      entityId: userId,
      action,
      actorId,
    },
    options,
  );
}

/**
 * Log group entity activity
 *
 * @param {Object} webhook - Webhook engine instance
 * @param {string} action - Action (created, updated, deleted)
 * @param {string} groupId - Group ID
 * @param {Object} data - Additional data
 * @param {Object} [options] - Additional send options
 */
export function logGroupActivity(
  webhook,
  action,
  groupId,
  data = {},
  actorId,
  options = {},
) {
  return logActivity(
    webhook,
    {
      ...data,
      event: `group.${action}`,
      entityType: 'group',
      entityId: groupId,
      action,
      actorId,
    },
    options,
  );
}

/**
 * Log role entity activity
 *
 * @param {Object} webhook - Webhook engine instance
 * @param {string} action - Action (created, updated, deleted)
 * @param {string} roleId - Role ID
 * @param {Object} data - Additional data
 * @param {Object} [options] - Additional send options
 */
export function logRoleActivity(
  webhook,
  action,
  roleId,
  data = {},
  actorId,
  options = {},
) {
  return logActivity(
    webhook,
    {
      ...data,
      event: `role.${action}`,
      entityType: 'role',
      entityId: roleId,
      action,
      actorId,
    },
    options,
  );
}

/**
 * Log permission entity activity
 *
 * @param {Object} webhook - Webhook engine instance
 * @param {string} action - Action (created, updated, deleted)
 * @param {string} permissionId - Permission ID
 * @param {Object} data - Additional data
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
