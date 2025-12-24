/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';
import { demoRoleIds } from './2025.11.26T00.03.00.demo-roles';
import { demoPermissionIds } from './2025.11.26T00.04.00.demo-permissions';

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;
  const now = new Date();

  const rolePermissions = [
    // Admin role - super admin permission (*:*)
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.superAdmin,
      created_at: now,
      updated_at: now,
    },

    // User role - read-only permissions
    {
      id: uuidv4(),
      role_id: demoRoleIds.user,
      permission_id: demoPermissionIds.usersRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.user,
      permission_id: demoPermissionIds.rolesRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.user,
      permission_id: demoPermissionIds.groupsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.user,
      permission_id: demoPermissionIds.permissionsRead,
      created_at: now,
      updated_at: now,
    },

    // Moderator role - read all + update users/groups
    {
      id: uuidv4(),
      role_id: demoRoleIds.mod,
      permission_id: demoPermissionIds.usersRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.mod,
      permission_id: demoPermissionIds.usersUpdate,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.mod,
      permission_id: demoPermissionIds.rolesRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.mod,
      permission_id: demoPermissionIds.groupsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.mod,
      permission_id: demoPermissionIds.groupsUpdate,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.mod,
      permission_id: demoPermissionIds.permissionsRead,
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('role_permissions', rolePermissions);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const { queryInterface } = context;

  // Remove all seeded role permissions by roleId
  await queryInterface.bulkDelete('role_permissions', {
    role_id: Object.values(demoRoleIds),
  });
}
