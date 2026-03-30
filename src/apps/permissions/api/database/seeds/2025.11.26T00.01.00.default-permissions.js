/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Default permission matrix — seeded on first run.
 * Defines the full CRUD + special-action permission set for every
 * core resource in the platform.  Each permission is a (resource, action)
 * pair referenced by role-permission assignments.
 */
export async function up(_, { container }) {
  const { Permission } = container.resolve('models');
  const SEED_PERMISSIONS = container.resolve('permissions:seed_constants');
  const { DEFAULT_RESOURCES, DEFAULT_ACTIONS } = container.resolve('auth');

  const permissions = [
    // =========================================================================
    // WILDCARD — super-admin
    // =========================================================================
    {
      id: SEED_PERMISSIONS.superAdmin,
      resource: DEFAULT_RESOURCES.ALL,
      action: DEFAULT_ACTIONS.MANAGE,
      description:
        'Super-admin wildcard — grants unrestricted access to every resource and action.',
      is_active: true,
    },

    // =========================================================================
    // USERS
    // =========================================================================
    {
      id: SEED_PERMISSIONS.usersCreate,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Provision new user accounts.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.usersRead,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.READ,
      description: 'View user profiles and account metadata.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.usersUpdate,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Modify user account details, status, and settings.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.usersDelete,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Permanently remove or soft-delete user accounts.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.usersImpersonate,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.IMPERSONATE,
      description:
        "Assume another user's session for support and debugging purposes.",
      is_active: true,
    },

    // =========================================================================
    // ROLES
    // =========================================================================
    {
      id: SEED_PERMISSIONS.rolesCreate,
      resource: DEFAULT_RESOURCES.ROLES,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Define new RBAC roles in the permission hierarchy.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.rolesRead,
      resource: DEFAULT_RESOURCES.ROLES,
      action: DEFAULT_ACTIONS.READ,
      description: 'View role definitions and their assigned permissions.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.rolesUpdate,
      resource: DEFAULT_RESOURCES.ROLES,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Modify role names, descriptions, and permission sets.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.rolesDelete,
      resource: DEFAULT_RESOURCES.ROLES,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Remove roles from the RBAC hierarchy.',
      is_active: true,
    },

    // =========================================================================
    // GROUPS
    // =========================================================================
    {
      id: SEED_PERMISSIONS.groupsCreate,
      resource: DEFAULT_RESOURCES.GROUPS,
      action: DEFAULT_ACTIONS.CREATE,
      description:
        'Create organisational groups for team-based access control.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.groupsRead,
      resource: DEFAULT_RESOURCES.GROUPS,
      action: DEFAULT_ACTIONS.READ,
      description: 'View group membership and role inheritance.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.groupsUpdate,
      resource: DEFAULT_RESOURCES.GROUPS,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Modify group configuration, membership, and role bindings.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.groupsDelete,
      resource: DEFAULT_RESOURCES.GROUPS,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Remove organisational groups and their role bindings.',
      is_active: true,
    },

    // =========================================================================
    // PERMISSIONS
    // =========================================================================
    {
      id: SEED_PERMISSIONS.permissionsCreate,
      resource: DEFAULT_RESOURCES.PERMISSIONS,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Register new resource-action permission entries.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.permissionsRead,
      resource: DEFAULT_RESOURCES.PERMISSIONS,
      action: DEFAULT_ACTIONS.READ,
      description: 'View the permission catalogue and role assignments.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.permissionsUpdate,
      resource: DEFAULT_RESOURCES.PERMISSIONS,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Edit permission descriptions and active/inactive state.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.permissionsDelete,
      resource: DEFAULT_RESOURCES.PERMISSIONS,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Remove permission entries from the catalogue.',
      is_active: true,
    },

    // =========================================================================
    // NODE-RED
    // =========================================================================
    {
      id: SEED_PERMISSIONS.nodeRedAdmin,
      resource: DEFAULT_RESOURCES.NODE_RED,
      action: DEFAULT_ACTIONS.MANAGE,
      description:
        'Full administrative access to the Node-RED editor — view, modify, and deploy flows.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.nodeRedReadOnly,
      resource: DEFAULT_RESOURCES.NODE_RED,
      action: DEFAULT_ACTIONS.READ,
      description:
        'Read-only access to the Node-RED editor — inspect flows and node configurations.',
      is_active: true,
    },

    // =========================================================================
    // API KEYS
    // =========================================================================
    {
      id: SEED_PERMISSIONS.apiKeysCreate,
      resource: DEFAULT_RESOURCES.API_KEYS,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Generate new API keys for programmatic access.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.apiKeysRead,
      resource: DEFAULT_RESOURCES.API_KEYS,
      action: DEFAULT_ACTIONS.READ,
      description: 'View API key metadata and usage statistics.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.apiKeysDelete,
      resource: DEFAULT_RESOURCES.API_KEYS,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Revoke and permanently remove API keys.',
      is_active: true,
    },
  ];

  await Permission.bulkCreate(permissions);
}

/**
 * Revert the seed
 */
export async function down(_, { container }) {
  const { Permission } = container.resolve('models');
  const SEED_PERMISSIONS = container.resolve('permissions:seed_constants');

  await Permission.destroy({
    where: { id: Object.values(SEED_PERMISSIONS) },
    force: true,
  });
}
