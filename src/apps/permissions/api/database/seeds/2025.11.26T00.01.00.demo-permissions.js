/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Run the seed
 */
export async function up(_, { app }) {
  const { Permission } = app.get('models');

  // Get seed permissions from container
  const SEED_PERMISSIONS = app
    .get('container')
    .resolve('permissions:seed_constants');

  // Get default resources and actions from auth
  const { DEFAULT_RESOURCES, DEFAULT_ACTIONS } = app.get('auth');

  const permissions = [
    // Super admin - full access
    {
      id: SEED_PERMISSIONS.superAdmin,
      resource: DEFAULT_RESOURCES.ALL,
      action: DEFAULT_ACTIONS.MANAGE,
      description: 'Super admin - full system access',
      is_active: true,
    },
    // Users CRUD
    {
      id: SEED_PERMISSIONS.usersCreate,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Create users',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.usersRead,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.READ,
      description: 'View users',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.usersUpdate,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Update users',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.usersDelete,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Delete users',
      is_active: true,
    },
    // Roles CRUD
    {
      id: SEED_PERMISSIONS.rolesCreate,
      resource: DEFAULT_RESOURCES.ROLES,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Create roles',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.rolesRead,
      resource: DEFAULT_RESOURCES.ROLES,
      action: DEFAULT_ACTIONS.READ,
      description: 'View roles',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.rolesUpdate,
      resource: DEFAULT_RESOURCES.ROLES,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Update roles',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.rolesDelete,
      resource: DEFAULT_RESOURCES.ROLES,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Delete roles',
      is_active: true,
    },
    // Groups CRUD
    {
      id: SEED_PERMISSIONS.groupsCreate,
      resource: DEFAULT_RESOURCES.GROUPS,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Create groups',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.groupsRead,
      resource: DEFAULT_RESOURCES.GROUPS,
      action: DEFAULT_ACTIONS.READ,
      description: 'View groups',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.groupsUpdate,
      resource: DEFAULT_RESOURCES.GROUPS,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Update groups',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.groupsDelete,
      resource: DEFAULT_RESOURCES.GROUPS,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Delete groups',
      is_active: true,
    },
    // Permissions CRUD
    {
      id: SEED_PERMISSIONS.permissionsCreate,
      resource: DEFAULT_RESOURCES.PERMISSIONS,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Create permissions',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.permissionsRead,
      resource: DEFAULT_RESOURCES.PERMISSIONS,
      action: DEFAULT_ACTIONS.READ,
      description: 'View permissions',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.permissionsUpdate,
      resource: DEFAULT_RESOURCES.PERMISSIONS,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Update permissions',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.permissionsDelete,
      resource: DEFAULT_RESOURCES.PERMISSIONS,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Delete permissions',
      is_active: true,
    },
    // Node-RED
    {
      id: SEED_PERMISSIONS.nodeRedAdmin,
      resource: DEFAULT_RESOURCES.NODE_RED,
      action: DEFAULT_ACTIONS.MANAGE,
      description:
        'Grants full access to the Node-RED editor and Admin API, allowing users to view, modify, and deploy flows, nodes, and settings.',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.nodeRedReadOnly,
      resource: DEFAULT_RESOURCES.NODE_RED,
      action: DEFAULT_ACTIONS.READ,
      description:
        'Grants read-only access to the Node-RED editor and Admin API, allowing users to view flows, nodes, and settings without making changes.',
      is_active: true,
    },
    // API Keys
    {
      id: SEED_PERMISSIONS.apiKeysCreate,
      resource: DEFAULT_RESOURCES.API_KEYS,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Create API keys',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.apiKeysRead,
      resource: DEFAULT_RESOURCES.API_KEYS,
      action: DEFAULT_ACTIONS.READ,
      description: 'View API keys',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.apiKeysDelete,
      resource: DEFAULT_RESOURCES.API_KEYS,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Delete API keys',
      is_active: true,
    },
    // Files CRUD
    {
      id: SEED_PERMISSIONS.filesCreate,
      resource: DEFAULT_RESOURCES.FILES,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Create/Upload files',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.filesRead,
      resource: DEFAULT_RESOURCES.FILES,
      action: DEFAULT_ACTIONS.READ,
      description: 'View files',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.filesUpdate,
      resource: DEFAULT_RESOURCES.FILES,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Update/Rename/Move files',
      is_active: true,
    },
    {
      id: SEED_PERMISSIONS.filesDelete,
      resource: DEFAULT_RESOURCES.FILES,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Delete files',
      is_active: true,
    },
  ];

  await Permission.bulkCreate(permissions);
}

/**
 * Revert the seed
 */
export async function down(_, { app }) {
  const { Permission } = app.get('models');

  // Get seed permissions from container
  const SEED_PERMISSIONS = app
    .get('container')
    .resolve('permissions:seed_constants');

  // Remove all seeded permissions by id
  await Permission.destroy({
    where: {
      id: Object.values(SEED_PERMISSIONS),
    },
    force: true, // Hard delete
  });
}
