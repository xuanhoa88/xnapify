/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Run the seed
 */
export async function up(_, { app }) {
  const { Permission, RolePermission } = app.get('models');

  // Get seed constants from container
  const container = app.get('container');
  const SEED_PERMISSIONS = container.resolve('files:seed_constants');
  const SEED_ROLES = container.resolve('roles:seed_constants');

  // Get default resources and actions from auth
  const { DEFAULT_RESOURCES, DEFAULT_ACTIONS } = app.get('auth');

  const permissions = [
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

  const rolePermissions = [
    // User role - files permissions
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.filesRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.filesCreate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.filesUpdate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.filesDelete,
    },

    // Moderator role - full files access
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.filesRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.filesCreate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.filesUpdate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.filesDelete,
    },

    // Editor role - full files access
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.filesRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.filesCreate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.filesUpdate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.filesDelete,
    },

    // Viewer role - read access only
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.filesRead,
    },
  ];

  await RolePermission.bulkCreate(rolePermissions);
}

/**
 * Revert the seed
 */
export async function down(_, { app }) {
  const { Permission, RolePermission } = app.get('models');

  // Get seed constants from container
  const container = app.get('container');
  const SEED_PERMISSIONS = container.resolve('files:seed_constants');

  // Remove role permissions first
  await RolePermission.destroy({
    where: {
      permission_id: Object.values(SEED_PERMISSIONS),
    },
    force: true,
  });

  // Remove all seeded permissions by id
  await Permission.destroy({
    where: {
      id: Object.values(SEED_PERMISSIONS),
    },
    force: true, // Hard delete
  });
}
