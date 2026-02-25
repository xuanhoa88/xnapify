/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Run the seed
 */
export async function up({ context }, { app }) {
  const now = new Date();

  const { queryInterface } = context;

  // Get seed permissions from container
  const container = app.get('container');
  const SEED_PERMISSIONS = container.resolve('SEED:PERMISSIONS');
  const RBAC_CONSTANTS = container.resolve('users:rbac_constants');

  const permissions = [
    // Super admin - full access
    {
      id: SEED_PERMISSIONS.superAdmin,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.ALL,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.MANAGE,
      description: 'Super admin - full system access',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Users CRUD
    {
      id: SEED_PERMISSIONS.usersCreate,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.USERS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.CREATE,
      description: 'Create users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.usersRead,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.USERS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.READ,
      description: 'View users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.usersUpdate,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.USERS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.UPDATE,
      description: 'Update users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.usersDelete,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.USERS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.DELETE,
      description: 'Delete users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Roles CRUD
    {
      id: SEED_PERMISSIONS.rolesCreate,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.ROLES,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.CREATE,
      description: 'Create roles',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.rolesRead,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.ROLES,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.READ,
      description: 'View roles',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.rolesUpdate,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.ROLES,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.UPDATE,
      description: 'Update roles',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.rolesDelete,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.ROLES,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.DELETE,
      description: 'Delete roles',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Groups CRUD
    {
      id: SEED_PERMISSIONS.groupsCreate,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.GROUPS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.CREATE,
      description: 'Create groups',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.groupsRead,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.GROUPS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.READ,
      description: 'View groups',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.groupsUpdate,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.GROUPS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.UPDATE,
      description: 'Update groups',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.groupsDelete,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.GROUPS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.DELETE,
      description: 'Delete groups',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Permissions CRUD
    {
      id: SEED_PERMISSIONS.permissionsCreate,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.PERMISSIONS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.CREATE,
      description: 'Create permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.permissionsRead,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.PERMISSIONS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.READ,
      description: 'View permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.permissionsUpdate,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.PERMISSIONS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.UPDATE,
      description: 'Update permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.permissionsDelete,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.PERMISSIONS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.DELETE,
      description: 'Delete permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Node-RED
    {
      id: SEED_PERMISSIONS.nodeRedAdmin,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.NODE_RED,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.MANAGE,
      description:
        'Grants full access to the Node-RED editor and Admin API, allowing users to view, modify, and deploy flows, nodes, and settings.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.nodeRedReadOnly,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.NODE_RED,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.READ,
      description:
        'Grants read-only access to the Node-RED editor and Admin API, allowing users to view flows, nodes, and settings without making changes.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // API Keys
    {
      id: SEED_PERMISSIONS.apiKeysCreate,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.API_KEYS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.CREATE,
      description: 'Create API keys',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.apiKeysRead,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.API_KEYS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.READ,
      description: 'View API keys',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_PERMISSIONS.apiKeysDelete,
      resource: RBAC_CONSTANTS.DEFAULT_RESOURCES.API_KEYS,
      action: RBAC_CONSTANTS.DEFAULT_ACTIONS.DELETE,
      description: 'Delete API keys',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('permissions', permissions);
}

/**
 * Revert the seed
 */
export async function down({ context }, { app }) {
  const { queryInterface } = context;

  // Get seed permissions from container
  const SEED_PERMISSIONS = app.get('container').resolve('SEED:PERMISSIONS');

  // Remove all seeded permissions by id
  await queryInterface.bulkDelete('permissions', {
    id: Object.values(SEED_PERMISSIONS),
  });
}
