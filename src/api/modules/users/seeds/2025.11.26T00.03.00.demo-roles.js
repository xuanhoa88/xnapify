/**
 * Seed: Demo Roles
 *
 * This seed creates common roles for RBAC system.
 */

import { v4 as uuidv4 } from 'uuid';

// Store role IDs for use in other seeds
export const demoRoleIds = {
  admin: uuidv4(),
  user: uuidv4(),
  moderator: uuidv4(),
  editor: uuidv4(),
  viewer: uuidv4(),
};

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;

  const now = new Date();

  const roles = [
    {
      id: demoRoleIds.admin,
      name: 'admin',
      description: 'System administrator with full access',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoRoleIds.user,
      name: 'user',
      description: 'Regular user with standard permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoRoleIds.moderator,
      name: 'moderator',
      description: 'Content moderator with moderation permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoRoleIds.editor,
      name: 'editor',
      description: 'Content editor with write permissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoRoleIds.viewer,
      name: 'viewer',
      description: 'Read-only access to resources',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('roles', roles);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const { queryInterface } = context;

  // Remove all seeded roles by name
  await queryInterface.bulkDelete('roles', {
    name: ['admin', 'user', 'moderator', 'editor', 'viewer'],
  });
}
