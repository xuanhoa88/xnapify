/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_RESOURCES, DEFAULT_ACTIONS } from '../../constants/rbac';

// Store permission IDs for use in other seeds
export const demoPermissionIds = {
  // Super admin
  superAdmin: uuidv4(),
  // Users CRUD
  usersCreate: uuidv4(),
  usersRead: uuidv4(),
  usersUpdate: uuidv4(),
  usersDelete: uuidv4(),
  // Roles CRUD
  rolesCreate: uuidv4(),
  rolesRead: uuidv4(),
  rolesUpdate: uuidv4(),
  rolesDelete: uuidv4(),
  // Groups CRUD
  groupsCreate: uuidv4(),
  groupsRead: uuidv4(),
  groupsUpdate: uuidv4(),
  groupsDelete: uuidv4(),
  // Permissions CRUD
  permissionsCreate: uuidv4(),
  permissionsRead: uuidv4(),
  permissionsUpdate: uuidv4(),
  permissionsDelete: uuidv4(),
  // Node-RED
  nodeRedAdmin: uuidv4(),
  nodeRedReadOnly: uuidv4(),
  // API Keys
  apiKeysCreate: uuidv4(),
  apiKeysRead: uuidv4(),
  apiKeysDelete: uuidv4(),
};

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;
  const now = new Date();

  const permissions = [
    // Super admin - full access
    {
      id: demoPermissionIds.superAdmin,
      resource: DEFAULT_RESOURCES.ALL,
      action: DEFAULT_ACTIONS.MANAGE,
      description: 'Super admin - full system access',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Users CRUD
    {
      id: demoPermissionIds.usersCreate,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Create users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.usersRead,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.READ,
      description: 'View users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.usersUpdate,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Update users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.usersDelete,
      resource: DEFAULT_RESOURCES.USERS,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Delete users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Roles CRUD
    {
      id: demoPermissionIds.rolesCreate,
      resource: DEFAULT_RESOURCES.ROLES,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Create roles',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.rolesRead,
      resource: DEFAULT_RESOURCES.ROLES,
      action: DEFAULT_ACTIONS.READ,
      description: 'View roles',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.rolesUpdate,
      resource: DEFAULT_RESOURCES.ROLES,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Update roles',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.rolesDelete,
      resource: DEFAULT_RESOURCES.ROLES,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Delete roles',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Groups CRUD
    {
      id: demoPermissionIds.groupsCreate,
      resource: DEFAULT_RESOURCES.GROUPS,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Create groups',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.groupsRead,
      resource: DEFAULT_RESOURCES.GROUPS,
      action: DEFAULT_ACTIONS.READ,
      description: 'View groups',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.groupsUpdate,
      resource: DEFAULT_RESOURCES.GROUPS,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Update groups',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.groupsDelete,
      resource: DEFAULT_RESOURCES.GROUPS,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Delete groups',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Permissions CRUD
    {
      id: demoPermissionIds.permissionsCreate,
      resource: DEFAULT_RESOURCES.PERMISSIONS,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Create permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.permissionsRead,
      resource: DEFAULT_RESOURCES.PERMISSIONS,
      action: DEFAULT_ACTIONS.READ,
      description: 'View permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.permissionsUpdate,
      resource: DEFAULT_RESOURCES.PERMISSIONS,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Update permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.permissionsDelete,
      resource: DEFAULT_RESOURCES.PERMISSIONS,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Delete permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Node-RED
    {
      id: demoPermissionIds.nodeRedAdmin,
      resource: DEFAULT_RESOURCES.NODE_RED,
      action: DEFAULT_ACTIONS.MANAGE,
      description:
        'Grants full access to the Node-RED editor and Admin API, allowing users to view, modify, and deploy flows, nodes, and settings.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.nodeRedReadOnly,
      resource: DEFAULT_RESOURCES.NODE_RED,
      action: DEFAULT_ACTIONS.READ,
      description:
        'Grants read-only access to the Node-RED editor and Admin API, allowing users to view flows, nodes, and settings without making changes.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // API Keys
    {
      id: demoPermissionIds.apiKeysCreate,
      resource: DEFAULT_RESOURCES.API_KEYS,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Create API keys',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.apiKeysRead,
      resource: DEFAULT_RESOURCES.API_KEYS,
      action: DEFAULT_ACTIONS.READ,
      description: 'View API keys',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.apiKeysDelete,
      resource: DEFAULT_RESOURCES.API_KEYS,
      action: DEFAULT_ACTIONS.DELETE,
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
export async function down({ context, Sequelize }) {
  const { queryInterface } = context;
  const { Op } = Sequelize;

  // Remove all seeded permissions by resource+action combinations
  await queryInterface.bulkDelete('permissions', {
    [Op.or]: [
      { resource: DEFAULT_RESOURCES.ALL, action: DEFAULT_ACTIONS.MANAGE },
      // Users CRUD
      { resource: DEFAULT_RESOURCES.USERS, action: DEFAULT_ACTIONS.CREATE },
      { resource: DEFAULT_RESOURCES.USERS, action: DEFAULT_ACTIONS.READ },
      { resource: DEFAULT_RESOURCES.USERS, action: DEFAULT_ACTIONS.UPDATE },
      { resource: DEFAULT_RESOURCES.USERS, action: DEFAULT_ACTIONS.DELETE },
      // Roles CRUD
      { resource: DEFAULT_RESOURCES.ROLES, action: DEFAULT_ACTIONS.CREATE },
      { resource: DEFAULT_RESOURCES.ROLES, action: DEFAULT_ACTIONS.READ },
      { resource: DEFAULT_RESOURCES.ROLES, action: DEFAULT_ACTIONS.UPDATE },
      { resource: DEFAULT_RESOURCES.ROLES, action: DEFAULT_ACTIONS.DELETE },
      // Groups CRUD
      { resource: DEFAULT_RESOURCES.GROUPS, action: DEFAULT_ACTIONS.CREATE },
      { resource: DEFAULT_RESOURCES.GROUPS, action: DEFAULT_ACTIONS.READ },
      { resource: DEFAULT_RESOURCES.GROUPS, action: DEFAULT_ACTIONS.UPDATE },
      { resource: DEFAULT_RESOURCES.GROUPS, action: DEFAULT_ACTIONS.DELETE },
      // Permissions CRUD
      {
        resource: DEFAULT_RESOURCES.PERMISSIONS,
        action: DEFAULT_ACTIONS.CREATE,
      },
      { resource: DEFAULT_RESOURCES.PERMISSIONS, action: DEFAULT_ACTIONS.READ },
      {
        resource: DEFAULT_RESOURCES.PERMISSIONS,
        action: DEFAULT_ACTIONS.UPDATE,
      },
      {
        resource: DEFAULT_RESOURCES.PERMISSIONS,
        action: DEFAULT_ACTIONS.DELETE,
      },
      // Node-RED
      { resource: DEFAULT_RESOURCES.NODE_RED, action: DEFAULT_ACTIONS.MANAGE },
      { resource: DEFAULT_RESOURCES.NODE_RED, action: DEFAULT_ACTIONS.READ },
      // API Keys CRUD
      { resource: DEFAULT_RESOURCES.API_KEYS, action: DEFAULT_ACTIONS.CREATE },
      { resource: DEFAULT_RESOURCES.API_KEYS, action: DEFAULT_ACTIONS.READ },
      { resource: DEFAULT_RESOURCES.API_KEYS, action: DEFAULT_ACTIONS.DELETE },
    ],
  });
}
