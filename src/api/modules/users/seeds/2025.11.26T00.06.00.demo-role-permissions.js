/**
 * Seed: Demo Role Permissions
 *
 * This seed assigns permissions to roles.
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
    // Admin role - all permissions
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.usersRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.usersWrite,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.usersDelete,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.postsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.postsWrite,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.postsDelete,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.commentsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.commentsWrite,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.commentsDelete,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.settingsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.settingsWrite,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.rolesRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.rolesWrite,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.permissionsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.permissionsWrite,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.groupsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.groupsWrite,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.usersManage,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.admin,
      permission_id: demoPermissionIds.systemAdmin,
      created_at: now,
      updated_at: now,
    },

    // User role - basic read/write permissions
    {
      id: uuidv4(),
      role_id: demoRoleIds.user,
      permission_id: demoPermissionIds.postsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.user,
      permission_id: demoPermissionIds.postsWrite,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.user,
      permission_id: demoPermissionIds.commentsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.user,
      permission_id: demoPermissionIds.commentsWrite,
      created_at: now,
      updated_at: now,
    },

    // Moderator role - read all, delete comments/posts
    {
      id: uuidv4(),
      role_id: demoRoleIds.moderator,
      permission_id: demoPermissionIds.postsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.moderator,
      permission_id: demoPermissionIds.postsDelete,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.moderator,
      permission_id: demoPermissionIds.commentsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.moderator,
      permission_id: demoPermissionIds.commentsDelete,
      created_at: now,
      updated_at: now,
    },

    // Editor role - read/write posts and comments
    {
      id: uuidv4(),
      role_id: demoRoleIds.editor,
      permission_id: demoPermissionIds.postsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.editor,
      permission_id: demoPermissionIds.postsWrite,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.editor,
      permission_id: demoPermissionIds.commentsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.editor,
      permission_id: demoPermissionIds.commentsWrite,
      created_at: now,
      updated_at: now,
    },

    // Viewer role - read-only access
    {
      id: uuidv4(),
      role_id: demoRoleIds.viewer,
      permission_id: demoPermissionIds.postsRead,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      role_id: demoRoleIds.viewer,
      permission_id: demoPermissionIds.commentsRead,
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
