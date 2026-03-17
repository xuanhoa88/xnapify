/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ------------------------------------------------------------------------
// ROLES
// Roles define a set of permissions that can be assigned to users.
// Users inherit all permissions from their assigned roles.
// ------------------------------------------------------------------------

/**
 * Default role assigned to new users
 */
export const DEFAULT_ROLE = 'user';

/**
 * Administrator role - Full system access
 */
export const ADMIN_ROLE = 'admin';

/**
 * Moderator role - Content moderation permissions
 */
export const MODERATOR_ROLE = 'mod';

/**
 * List of all system roles recognized by the application.
 * These roles cannot be deleted.
 */
export const SYSTEM_ROLES = Object.freeze([
  DEFAULT_ROLE,
  ADMIN_ROLE,
  MODERATOR_ROLE,
]);

// ------------------------------------------------------------------------
// GROUPS
// Groups are organizational units that aggregate users.
// Groups can be assigned roles, and users inherit permissions from
// the roles assigned to their groups.
// ------------------------------------------------------------------------

/**
 * Default group assigned to new users
 */
export const DEFAULT_GROUP = 'users';

/**
 * Administrator group - System administrators with full access
 */
export const ADMIN_GROUP = 'administrators';

/**
 * List of all system groups recognized by the application.
 * These groups cannot be deleted.
 */
export const SYSTEM_GROUPS = Object.freeze([DEFAULT_GROUP, ADMIN_GROUP]);

// ------------------------------------------------------------------------
// PERMISSIONS
// Permissions define granular access rights following the resource:action pattern.
// A permission consists of a resource (what) and an action (how).
// ------------------------------------------------------------------------

/**
 * Standard RBAC actions (CRUD + wildcard)
 */
export const DEFAULT_ACTIONS = Object.freeze({
  MANAGE: '*', // Wildcard: full control (all actions)
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  IMPERSONATE: 'impersonate',
});

/**
 * System resources
 */
export const DEFAULT_RESOURCES = Object.freeze({
  ALL: '*', // Wildcard: all resources (super admin)
  USERS: 'users',
  ROLES: 'roles',
  GROUPS: 'groups',
  PERMISSIONS: 'permissions',
  API_KEYS: 'apiKeys',
  NODE_RED: 'nodered',
  FILES: 'files',
  EMAILS: 'emails',
  WEBHOOKS: 'webhooks',
  ACTIVITIES: 'activities',
  PLUGINS: 'plugins',
});

/**
 * System permissions that cannot be deleted.
 * Format: { resource, action, description }
 */
export const SYSTEM_PERMISSIONS = Object.freeze([
  // Super admin - full access to all resources and actions
  {
    resource: DEFAULT_RESOURCES.ALL,
    action: DEFAULT_ACTIONS.MANAGE,
    description: 'Super admin - full system access',
  },

  // User management (CRUD)
  {
    resource: DEFAULT_RESOURCES.USERS,
    action: DEFAULT_ACTIONS.CREATE,
    description: 'Create users',
  },
  {
    resource: DEFAULT_RESOURCES.USERS,
    action: DEFAULT_ACTIONS.READ,
    description: 'View users',
  },
  {
    resource: DEFAULT_RESOURCES.USERS,
    action: DEFAULT_ACTIONS.UPDATE,
    description: 'Update users',
  },
  {
    resource: DEFAULT_RESOURCES.USERS,
    action: DEFAULT_ACTIONS.DELETE,
    description: 'Delete users',
  },
  {
    resource: DEFAULT_RESOURCES.USERS,
    action: DEFAULT_ACTIONS.IMPERSONATE,
    description: 'Impersonate users',
  },

  // Role management (CRUD)
  {
    resource: DEFAULT_RESOURCES.ROLES,
    action: DEFAULT_ACTIONS.CREATE,
    description: 'Create roles',
  },
  {
    resource: DEFAULT_RESOURCES.ROLES,
    action: DEFAULT_ACTIONS.READ,
    description: 'View roles',
  },
  {
    resource: DEFAULT_RESOURCES.ROLES,
    action: DEFAULT_ACTIONS.UPDATE,
    description: 'Update roles',
  },
  {
    resource: DEFAULT_RESOURCES.ROLES,
    action: DEFAULT_ACTIONS.DELETE,
    description: 'Delete roles',
  },

  // Group management (CRUD)
  {
    resource: DEFAULT_RESOURCES.GROUPS,
    action: DEFAULT_ACTIONS.CREATE,
    description: 'Create groups',
  },
  {
    resource: DEFAULT_RESOURCES.GROUPS,
    action: DEFAULT_ACTIONS.READ,
    description: 'View groups',
  },
  {
    resource: DEFAULT_RESOURCES.GROUPS,
    action: DEFAULT_ACTIONS.UPDATE,
    description: 'Update groups',
  },
  {
    resource: DEFAULT_RESOURCES.GROUPS,
    action: DEFAULT_ACTIONS.DELETE,
    description: 'Delete groups',
  },

  // Permission management (CRUD)
  {
    resource: DEFAULT_RESOURCES.PERMISSIONS,
    action: DEFAULT_ACTIONS.CREATE,
    description: 'Create permissions',
  },
  {
    resource: DEFAULT_RESOURCES.PERMISSIONS,
    action: DEFAULT_ACTIONS.READ,
    description: 'View permissions',
  },
  {
    resource: DEFAULT_RESOURCES.PERMISSIONS,
    action: DEFAULT_ACTIONS.UPDATE,
    description: 'Update permissions',
  },
  {
    resource: DEFAULT_RESOURCES.PERMISSIONS,
    action: DEFAULT_ACTIONS.DELETE,
    description: 'Delete permissions',
  },

  // Node-RED Access
  {
    resource: DEFAULT_RESOURCES.NODE_RED,
    action: 'admin',
    description:
      'Grants full access to the Node-RED editor and Admin API, allowing users to view, modify, and deploy flows, nodes, and settings.',
  },
  {
    resource: DEFAULT_RESOURCES.NODE_RED,
    action: 'read',
    description:
      'Grants read-only access to the Node-RED editor and Admin API, allowing users to view flows, nodes, and settings without making changes.',
  },

  // API Key management
  {
    resource: DEFAULT_RESOURCES.API_KEYS,
    action: DEFAULT_ACTIONS.CREATE,
    description: 'Create API keys',
  },
  {
    resource: DEFAULT_RESOURCES.API_KEYS,
    action: DEFAULT_ACTIONS.DELETE,
    description: 'Delete API keys',
  },

  // File management (CRUD)
  {
    resource: DEFAULT_RESOURCES.FILES,
    action: DEFAULT_ACTIONS.CREATE,
    description: 'Create/Upload files',
  },
  {
    resource: DEFAULT_RESOURCES.FILES,
    action: DEFAULT_ACTIONS.READ,
    description: 'View files',
  },
  {
    resource: DEFAULT_RESOURCES.FILES,
    action: DEFAULT_ACTIONS.UPDATE,
    description: 'Update/Rename/Move files',
  },
  {
    resource: DEFAULT_RESOURCES.FILES,
    action: DEFAULT_ACTIONS.DELETE,
    description: 'Delete files',
  },

  // Activity logs (read only)
  {
    resource: DEFAULT_RESOURCES.ACTIVITIES,
    action: DEFAULT_ACTIONS.READ,
    description: 'View activity logs',
  },

  // Plugin management
  {
    resource: DEFAULT_RESOURCES.PLUGINS,
    action: DEFAULT_ACTIONS.CREATE,
    description: 'Upload/Install plugins',
  },
  {
    resource: DEFAULT_RESOURCES.PLUGINS,
    action: DEFAULT_ACTIONS.READ,
    description: 'View plugins',
  },
  {
    resource: DEFAULT_RESOURCES.PLUGINS,
    action: DEFAULT_ACTIONS.UPDATE,
    description: 'Enable/Disable plugins',
  },
  {
    resource: DEFAULT_RESOURCES.PLUGINS,
    action: DEFAULT_ACTIONS.DELETE,
    description: 'Delete plugins',
  },
]);
