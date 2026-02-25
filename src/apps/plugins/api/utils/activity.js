/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Plugin Activity Logger
 *
 * Utility for logging plugin activities using the webhook database adapter.
 */

/**
 * Log a user/system activity
 *
 * @param {Object} webhook - Webhook engine instance
 * @param {Object} activity - Activity data
 * @param {string} activity.event - Event type (e.g., 'plugin.installed')
 * @param {string} activity.entityType - Entity type (plugin)
 * @param {string} activity.entityId - Entity ID
 * @param {string} activity.action - Action performed (install, update, delete)
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

    // Use webhook.send to allow for worker processing if configured
    const result = await webhook.send(
      {
        ...payload,
        event,
        status: 'delivered', // Activity logs are audit records
        entity_type: entityType,
        entity_id: entityId,
        actor_id: actorId,
        timestamp: new Date().toISOString(),
        type: 'user_activity', // Reuse user_activity type for consistent logging/UI or 'plugin_activity'
        // Using 'user_activity' might make it show up in global activity logs if they filter by type.
        // Let's stick to the pattern in users module which sets type: 'user_activity'.
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
    return null;
  }
}

/**
 * Log plugin entity activity
 *
 * @param {Object} webhook - Webhook engine instance
 * @param {string} action - Action (installed, updated, deleted, status_changed)
 * @param {string} pluginId - Plugin ID (or Key)
 * @param {Object} data - Additional data
 * @param {string} [actorId] - ID of user performing the action
 */
export function logPluginActivity(
  webhook,
  action,
  pluginId,
  data = {},
  actorId,
) {
  return logActivity(webhook, {
    ...data,
    event: `plugin.${action}`,
    entityType: 'plugin',
    entityId: pluginId,
    action,
    actorId,
  });
}
