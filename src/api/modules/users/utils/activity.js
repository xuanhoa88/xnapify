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
 * @returns {Promise<Object|null>} Activity result or null if webhook unavailable
 */
export async function logActivity(webhook, activity) {
  if (!webhook) {
    return null;
  }

  const dbAdapter = webhook.getAdapter('database');
  if (!dbAdapter || !dbAdapter.hasConnection()) {
    return null;
  }

  const {
    event,
    entityType,
    entityId,
    action,
    data = {},
    actorId = null,
  } = activity;

  try {
    const result = await dbAdapter.send(
      {
        url: `activity://${event}`,
        entity_type: entityType,
        entity_id: entityId,
        action,
        actor_id: actorId,
        timestamp: new Date().toISOString(),
        ...data,
      },
      {
        event,
        metadata: {
          type: 'user_activity',
          entity_type: entityType,
          entity_id: entityId,
          action,
          actor_id: actorId,
        },
      },
    );

    return result;
  } catch (error) {
    console.error(`Failed to log activity: ${event}`, error.message);
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
 * @param {string} [actorId] - Actor ID
 */
export function logUserActivity(webhook, action, userId, data = {}, actorId) {
  return logActivity(webhook, {
    event: `user.${action}`,
    entityType: 'user',
    entityId: userId,
    action,
    data,
    actorId,
  });
}

/**
 * Log group entity activity
 *
 * @param {Object} webhook - Webhook engine instance
 * @param {string} action - Action (created, updated, deleted)
 * @param {string} groupId - Group ID
 * @param {Object} data - Additional data
 * @param {string} [actorId] - Actor ID
 */
export function logGroupActivity(webhook, action, groupId, data = {}, actorId) {
  return logActivity(webhook, {
    event: `group.${action}`,
    entityType: 'group',
    entityId: groupId,
    action,
    data,
    actorId,
  });
}

/**
 * Log role entity activity
 *
 * @param {Object} webhook - Webhook engine instance
 * @param {string} action - Action (created, updated, deleted)
 * @param {string} roleId - Role ID
 * @param {Object} data - Additional data
 * @param {string} [actorId] - Actor ID
 */
export function logRoleActivity(webhook, action, roleId, data = {}, actorId) {
  return logActivity(webhook, {
    event: `role.${action}`,
    entityType: 'role',
    entityId: roleId,
    action,
    data,
    actorId,
  });
}

/**
 * Log permission entity activity
 *
 * @param {Object} webhook - Webhook engine instance
 * @param {string} action - Action (created, updated, deleted)
 * @param {string} permissionId - Permission ID
 * @param {Object} data - Additional data
 * @param {string} [actorId] - Actor ID
 */
export function logPermissionActivity(
  webhook,
  action,
  permissionId,
  data = {},
  actorId,
) {
  return logActivity(webhook, {
    event: `permission.${action}`,
    entityType: 'permission',
    entityId: permissionId,
    action,
    data,
    actorId,
  });
}
