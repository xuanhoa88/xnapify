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
      resource: 'users',
      action: 'create',
      description: 'Create users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.usersRead,
      resource: 'users',
      action: 'read',
      description: 'View users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.usersUpdate,
      resource: 'users',
      action: 'update',
      description: 'Update users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.usersDelete,
      resource: 'users',
      action: 'delete',
      description: 'Delete users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Roles CRUD
    {
      id: demoPermissionIds.rolesCreate,
      resource: 'roles',
      action: 'create',
      description: 'Create roles',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.rolesRead,
      resource: 'roles',
      action: 'read',
      description: 'View roles',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.rolesUpdate,
      resource: 'roles',
      action: 'update',
      description: 'Update roles',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.rolesDelete,
      resource: 'roles',
      action: 'delete',
      description: 'Delete roles',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Groups CRUD
    {
      id: demoPermissionIds.groupsCreate,
      resource: 'groups',
      action: 'create',
      description: 'Create groups',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.groupsRead,
      resource: 'groups',
      action: 'read',
      description: 'View groups',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.groupsUpdate,
      resource: 'groups',
      action: 'update',
      description: 'Update groups',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.groupsDelete,
      resource: 'groups',
      action: 'delete',
      description: 'Delete groups',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Permissions CRUD
    {
      id: demoPermissionIds.permissionsCreate,
      resource: 'permissions',
      action: 'create',
      description: 'Create permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.permissionsRead,
      resource: 'permissions',
      action: 'read',
      description: 'View permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.permissionsUpdate,
      resource: 'permissions',
      action: 'update',
      description: 'Update permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.permissionsDelete,
      resource: 'permissions',
      action: 'delete',
      description: 'Delete permissions',
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
      { resource: 'users', action: 'create' },
      { resource: 'users', action: 'read' },
      { resource: 'users', action: 'update' },
      { resource: 'users', action: 'delete' },
      // Roles CRUD
      { resource: 'roles', action: 'create' },
      { resource: 'roles', action: 'read' },
      { resource: 'roles', action: 'update' },
      { resource: 'roles', action: 'delete' },
      // Groups CRUD
      { resource: 'groups', action: 'create' },
      { resource: 'groups', action: 'read' },
      { resource: 'groups', action: 'update' },
      { resource: 'groups', action: 'delete' },
      // Permissions CRUD
      { resource: 'permissions', action: 'create' },
      { resource: 'permissions', action: 'read' },
      { resource: 'permissions', action: 'update' },
      { resource: 'permissions', action: 'delete' },
    ],
  });
}
