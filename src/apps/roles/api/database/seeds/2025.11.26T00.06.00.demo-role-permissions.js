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
export async function up({ context }, { app }) {
  const { queryInterface } = context;
  const now = new Date();

  // Get seed roles from container
  const container = app.get('container');
  const SEED_ROLES = container.resolve('SEED:ROLES');
  const SEED_PERMISSIONS = container.resolve('SEED:PERMISSIONS');

  const rolePermissions = [
    // Admin role - super admin permission (*:*) grants all permissions dynamically
    {
      id: uuidv4(),
      role_id: SEED_ROLES.admin,
      permission_id: SEED_PERMISSIONS.superAdmin,
      created_at: now,
      updated_at: now,
    },

    // User role - read-only permissions
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.usersRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.rolesRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.groupsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.permissionsRead,
      created_at: now,
      updated_at: now,
    },

    // Moderator role - read all + update users/groups
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.usersRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.usersUpdate,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.rolesRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.groupsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.groupsUpdate,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.permissionsRead,
      created_at: now,
      updated_at: now,
    },

    // Editor role - read all + create/update users
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.usersRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.usersCreate,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.usersUpdate,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.rolesRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.groupsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.permissionsRead,
      created_at: now,
      updated_at: now,
    },

    // Viewer role - read-only permissions
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.usersRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.rolesRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.groupsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.permissionsRead,
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('role_permissions', rolePermissions);
}

/**
 * Revert the seed
 */
export async function down({ context }, { app }) {
  const { queryInterface } = context;

  // Get seed roles from container
  const SEED_ROLES = app.get('container').resolve('SEED:ROLES');

  // Remove all seeded role permissions by roleId
  await queryInterface.bulkDelete('role_permissions', {
    role_id: Object.values(SEED_ROLES),
  });
}
