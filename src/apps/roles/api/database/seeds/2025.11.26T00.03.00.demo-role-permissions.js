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
  const { RolePermission } = app.get('models');

  // Get seed roles from container
  const container = app.get('container');
  const SEED_ROLES = container.resolve('roles:seed_constants');
  const SEED_PERMISSIONS = container.resolve('permissions:seed_constants');

  const rolePermissions = [
    // Admin role - super admin permission (*:*) grants all permissions dynamically
    {
      id: uuidv4(),
      role_id: SEED_ROLES.admin,
      permission_id: SEED_PERMISSIONS.superAdmin,
    },

    // User role - read-only permissions
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.usersRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.rolesRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.groupsRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.permissionsRead,
    },
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

    // Moderator role - read all + update users/groups
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.usersRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.usersUpdate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.rolesRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.groupsRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.groupsUpdate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.permissionsRead,
    },
    // Mod gets full files access
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

    // Editor role - read all + create/update users
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.usersRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.usersCreate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.usersUpdate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.rolesRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.groupsRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.permissionsRead,
    },
    // Editor gets full files access
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

    // Viewer role - read-only permissions
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.usersRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.rolesRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.groupsRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.permissionsRead,
    },
    // Viewer only gets read access
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
  const { RolePermission } = app.get('models');

  // Get seed roles from container
  const SEED_ROLES = app.get('container').resolve('roles:seed_constants');

  // Remove all seeded role permissions by roleId
  await RolePermission.destroy({
    where: {
      role_id: Object.values(SEED_ROLES),
    },
    force: true, // Hard delete
  });
}
