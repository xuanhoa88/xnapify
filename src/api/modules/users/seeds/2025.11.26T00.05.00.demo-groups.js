/**
 * Seed: Demo Groups
 *
 * This seed creates common groups for organizing users.
 */

import { v4 as uuidv4 } from 'uuid';

// Store group IDs for use in other seeds
export const demoGroupIds = {
  engineering: uuidv4(),
  marketing: uuidv4(),
  support: uuidv4(),
  management: uuidv4(),
};

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;

  const now = new Date();

  const groups = [
    {
      id: demoGroupIds.engineering,
      name: 'Engineering',
      description: 'Engineering and development team',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoGroupIds.marketing,
      name: 'Marketing',
      description: 'Marketing and communications team',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoGroupIds.support,
      name: 'Support',
      description: 'Customer support team',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: demoGroupIds.management,
      name: 'Management',
      description: 'Management and leadership team',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('groups', groups);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const { queryInterface } = context;

  // Remove all seeded groups by name
  await queryInterface.bulkDelete('groups', {
    name: ['Engineering', 'Marketing', 'Support', 'Management'],
  });
}
