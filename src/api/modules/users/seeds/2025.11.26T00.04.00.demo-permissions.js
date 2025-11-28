/**
 * Seed: Demo Permissions
 *
 * This seed creates common permissions for RBAC system.
 */

import { v4 as uuidv4 } from 'uuid';

// Store permission IDs for use in other seeds
export const demoPermissionIds = {
  usersRead: uuidv4(),
  usersWrite: uuidv4(),
  usersDelete: uuidv4(),
  postsRead: uuidv4(),
  postsWrite: uuidv4(),
  postsDelete: uuidv4(),
  commentsRead: uuidv4(),
  commentsWrite: uuidv4(),
  commentsDelete: uuidv4(),
  settingsRead: uuidv4(),
  settingsWrite: uuidv4(),
};

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;

  const now = new Date();

  const permissions = [
    // User permissions
    {
      id: demoPermissionIds.usersRead,
      name: 'users:read',
      resource: 'users',
      action: 'read',
      description: 'View user information',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.usersWrite,
      name: 'users:write',
      resource: 'users',
      action: 'write',
      description: 'Create and update users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.usersDelete,
      name: 'users:delete',
      resource: 'users',
      action: 'delete',
      description: 'Delete users',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Post permissions
    {
      id: demoPermissionIds.postsRead,
      name: 'posts:read',
      resource: 'posts',
      action: 'read',
      description: 'View posts',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.postsWrite,
      name: 'posts:write',
      resource: 'posts',
      action: 'write',
      description: 'Create and update posts',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.postsDelete,
      name: 'posts:delete',
      resource: 'posts',
      action: 'delete',
      description: 'Delete posts',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Comment permissions
    {
      id: demoPermissionIds.commentsRead,
      name: 'comments:read',
      resource: 'comments',
      action: 'read',
      description: 'View comments',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.commentsWrite,
      name: 'comments:write',
      resource: 'comments',
      action: 'write',
      description: 'Create and update comments',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.commentsDelete,
      name: 'comments:delete',
      resource: 'comments',
      action: 'delete',
      description: 'Delete comments',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Settings permissions
    {
      id: demoPermissionIds.settingsRead,
      name: 'settings:read',
      resource: 'settings',
      action: 'read',
      description: 'View system settings',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoPermissionIds.settingsWrite,
      name: 'settings:write',
      resource: 'settings',
      action: 'write',
      description: 'Modify system settings',
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
export async function down({ context }) {
  const { queryInterface } = context;

  // Remove all seeded permissions by name
  await queryInterface.bulkDelete('permissions', {
    name: [
      'users:read',
      'users:write',
      'users:delete',
      'posts:read',
      'posts:write',
      'posts:delete',
      'comments:read',
      'comments:write',
      'comments:delete',
      'settings:read',
      'settings:write',
    ],
  });
}
