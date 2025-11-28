/**
 * Seed: Demo Group Roles
 *
 * This seed assigns roles to groups.
 */

import { v4 as uuidv4 } from 'uuid';
import { demoGroupIds } from './2025.11.26T00.05.00.demo-groups';
import { demoRoleIds } from './2025.11.26T00.03.00.demo-roles';

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;

  const now = new Date();

  const groupRoles = [
    // Engineering group - editor role
    {
      id: uuidv4(),
      group_id: demoGroupIds.engineering,
      role_id: demoRoleIds.editor,
      created_at: now,
      updated_at: now,
    },

    // Marketing group - user role
    {
      id: uuidv4(),
      group_id: demoGroupIds.marketing,
      role_id: demoRoleIds.user,
      created_at: now,
      updated_at: now,
    },

    // Support group - moderator role
    {
      id: uuidv4(),
      group_id: demoGroupIds.support,
      role_id: demoRoleIds.moderator,
      created_at: now,
      updated_at: now,
    },

    // Management group - admin role
    {
      id: uuidv4(),
      group_id: demoGroupIds.management,
      role_id: demoRoleIds.admin,
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('group_roles', groupRoles);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const { queryInterface } = context;

  // Remove all seeded group roles by groupId
  await queryInterface.bulkDelete('group_roles', {
    group_id: Object.values(demoGroupIds),
  });
}
