/**
 * Seed: Demo User Groups
 *
 * This seed assigns users to groups.
 */

import { v4 as uuidv4 } from 'uuid';
import { demoUserIds } from './2025.11.26T00.00.00.demo-users';
import { demoGroupIds } from './2025.11.26T00.05.00.demo-groups';

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;

  const now = new Date();

  const userGroups = [
    // Admin - Management group
    {
      id: uuidv4(),
      user_id: demoUserIds.admin,
      group_id: demoGroupIds.management,
      created_at: now,
      updated_at: now,
    },

    // John - Engineering group
    {
      id: uuidv4(),
      user_id: demoUserIds.john,
      group_id: demoGroupIds.engineering,
      created_at: now,
      updated_at: now,
    },

    // Jane - Marketing and Support groups
    {
      id: uuidv4(),
      user_id: demoUserIds.jane,
      group_id: demoGroupIds.marketing,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      user_id: demoUserIds.jane,
      group_id: demoGroupIds.support,
      created_at: now,
      updated_at: now,
    },

    // Locked user - Support group
    {
      id: uuidv4(),
      user_id: demoUserIds.locked,
      group_id: demoGroupIds.support,
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('user_groups', userGroups);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const { queryInterface } = context;

  // Remove all seeded user groups by userId
  await queryInterface.bulkDelete('user_groups', {
    user_id: Object.values(demoUserIds),
  });
}
