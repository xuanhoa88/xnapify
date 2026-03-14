/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Hooks - Observes system events and dispatches log tasks
 */

/**
 * Register activities hooks
 * @param {Object} app - Express app instance
 */
export function registerActivityHooks(app) {
  const hook = app.get('hook');
  const activitiesWorker = app.get('container').resolve('activities:worker');

  if (!hook || !activitiesWorker) {
    console.warn('[Activity] ⚠️ Hook engine or worker pool not available');
    return;
  }

  /**
   * Helper to execute a logging task safely
   * @param {string} label - Event label
   * @param {Function} transformer - Function to transform event payload to activities record
   */
  const safeLog = (label, transformer) => async payload => {
    try {
      const activitiesRecord = transformer(payload);
      if (activitiesRecord) {
        await activitiesWorker.log(activitiesRecord);
      }
    } catch (error) {
      const message =
        (error.response && error.response.data && error.response.data.error) ||
        error.message ||
        'Failed to fetch activities';
      console.warn(`[Activity] Hook [${label}] error: ${message}`);
    }
  };

  // -- Auth Hooks -----------------------------------------------------------

  hook('auth').on(
    'registered',
    safeLog('auth:registered', ({ user_id, email }) => ({
      event: 'auth.registered',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: user_id,
      data: { email },
    })),
  );

  hook('auth').on(
    'logged_in',
    safeLog('auth:logged_in', ({ user_id, activitiesData }) => ({
      event: 'auth.logged_in',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: user_id,
      data: activitiesData,
    })),
  );

  hook('auth').on(
    'logout',
    safeLog('auth:logout', ({ user_id }) => ({
      event: 'auth.logout',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: user_id,
    })),
  );

  hook('auth').on(
    'email_verified',
    safeLog('auth:email_verified', ({ user_id, email }) => ({
      event: 'auth.email_verified',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: user_id,
      data: { email },
    })),
  );

  hook('auth').on(
    'password_reset_requested',
    safeLog('auth:password_reset_requested', ({ user_id, email }) => ({
      event: 'auth.password_reset_requested',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: user_id,
      data: { email },
    })),
  );

  hook('auth').on(
    'password_reset_completed',
    safeLog('auth:password_reset_completed', ({ user_id }) => ({
      event: 'auth.password_reset_completed',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: user_id,
    })),
  );

  // -- Admin User Hooks -----------------------------------------------------

  hook('admin:users').on(
    'created',
    safeLog('admin:users:created', ({ user, actorId }) => ({
      event: 'admin:users:created',
      entity_type: 'user',
      entity_id: user.id,
      actor_id: actorId,
      data: { email: user.email },
    })),
  );

  hook('admin:users').on(
    'updated',
    safeLog('admin:users:updated', ({ user, actorId }) => ({
      event: 'admin:users:updated',
      entity_type: 'user',
      entity_id: user.id,
      actor_id: actorId,
    })),
  );

  hook('admin:users').on(
    'status_updated',
    safeLog('admin:users:status_updated', ({ user, actorId, isActive }) => ({
      event: 'admin:users:status_updated',
      entity_type: 'user',
      entity_id: user.id,
      actor_id: actorId,
      data: { isActive },
    })),
  );

  hook('admin:users').on(
    'deleted',
    safeLog('admin:users:deleted', ({ user_id, actorId }) => ({
      event: 'admin:users:deleted',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: actorId,
    })),
  );

  // -- Profile Hooks --------------------------------------------------------

  hook('profile').on(
    'updated',
    safeLog('profile:updated', ({ user_id }) => ({
      event: 'profile.updated',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: user_id,
    })),
  );

  hook('profile').on(
    'password_changed',
    safeLog('profile:password_changed', ({ user_id }) => ({
      event: 'profile.password_changed',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: user_id,
    })),
  );

  hook('profile').on(
    'preferences_updated',
    safeLog('profile:preferences_updated', ({ user_id }) => ({
      event: 'profile.preferences_updated',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: user_id,
    })),
  );

  hook('profile').on(
    'account_deleted',
    safeLog('profile:account_deleted', ({ user_id }) => ({
      event: 'profile.account_deleted',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: user_id,
    })),
  );

  // -- Admin Group Hooks ----------------------------------------------------

  hook('admin:groups').on(
    'created',
    safeLog('admin:groups:created', ({ group, actorId }) => ({
      event: 'admin:groups:created',
      entity_type: 'group',
      entity_id: group.id,
      actor_id: actorId,
      data: { name: group.name },
    })),
  );

  hook('admin:groups').on(
    'updated',
    safeLog('admin:groups:updated', ({ group, actorId }) => ({
      event: 'admin:groups:updated',
      entity_type: 'group',
      entity_id: group.id,
      actor_id: actorId,
      data: { name: group.name },
    })),
  );

  hook('admin:groups').on(
    'deleted',
    safeLog('admin:groups:deleted', ({ group_id, actorId, name }) => ({
      event: 'admin:groups:deleted',
      entity_type: 'group',
      entity_id: group_id,
      actor_id: actorId,
      data: { name },
    })),
  );

  // -- Admin Role Hooks (Phase 2 events) ------------------------------------

  hook('admin:roles').on(
    'created',
    safeLog('admin:roles:created', ({ role, actorId }) => ({
      event: 'admin:roles:created',
      entity_type: 'role',
      entity_id: role.id,
      actor_id: actorId,
      data: { name: role.name },
    })),
  );

  hook('admin:roles').on(
    'updated',
    safeLog('admin:roles:updated', ({ role, actorId }) => ({
      event: 'admin:roles:updated',
      entity_type: 'role',
      entity_id: role.id,
      actor_id: actorId,
      data: { name: role.name },
    })),
  );

  hook('admin:roles').on(
    'deleted',
    safeLog('admin:roles:deleted', ({ role_id, actorId, name }) => ({
      event: 'admin:roles:deleted',
      entity_type: 'role',
      entity_id: role_id,
      actor_id: actorId,
      data: { name },
    })),
  );

  // -- Admin Permission Hooks (Phase 2 events) ------------------------------

  hook('admin:permissions').on(
    'created',
    safeLog('admin:permissions:created', ({ permission, actorId }) => ({
      event: 'admin:permissions:created',
      entity_type: 'permission',
      entity_id: permission.id,
      actor_id: actorId,
      data: { resource: permission.resource, action: permission.action },
    })),
  );

  hook('admin:permissions').on(
    'updated',
    safeLog('admin:permissions:updated', ({ permission, actorId }) => ({
      event: 'admin:permissions:updated',
      entity_type: 'permission',
      entity_id: permission.id,
      actor_id: actorId,
    })),
  );

  hook('admin:permissions').on(
    'deleted',
    safeLog('admin:permissions:deleted', ({ permission_id, actorId }) => ({
      event: 'admin:permissions:deleted',
      entity_type: 'permission',
      entity_id: permission_id,
      actor_id: actorId,
    })),
  );

  // -- Admin RBAC Hooks (Phase 2 events) ------------------------------------

  hook('admin:rbac').on(
    'role_assigned',
    safeLog('admin:rbac:role_assigned', ({ user_id, role_name, actorId }) => ({
      event: 'admin:rbac:role_assigned',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: actorId,
      data: { role: role_name },
    })),
  );

  hook('admin:rbac').on(
    'role_removed',
    safeLog('admin:rbac:role_removed', ({ user_id, role_name, actorId }) => ({
      event: 'admin:rbac:role_removed',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: actorId,
      data: { role: role_name },
    })),
  );

  hook('admin:rbac').on(
    'group_assigned',
    safeLog(
      'admin:rbac:group_assigned',
      ({ user_id, group_name, actorId }) => ({
        event: 'admin:rbac:group_assigned',
        entity_type: 'user',
        entity_id: user_id,
        actor_id: actorId,
        data: { group: group_name },
      }),
    ),
  );

  hook('admin:rbac').on(
    'group_removed',
    safeLog('admin:rbac:group_removed', ({ user_id, group_name, actorId }) => ({
      event: 'admin:rbac:group_removed',
      entity_type: 'user',
      entity_id: user_id,
      actor_id: actorId,
      data: { group: group_name },
    })),
  );
}
