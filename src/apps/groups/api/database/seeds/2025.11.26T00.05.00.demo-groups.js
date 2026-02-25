/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Run the seed
 */
export async function up({ context }, { app }) {
  const { queryInterface } = context;

  // Get seed groups from container
  const SEED_GROUPS = app.get('container').resolve('SEED:GROUPS');

  const now = new Date();

  const groups = [
    {
      id: SEED_GROUPS.engineering,
      name: 'Engineering',
      description: 'Engineering and development team',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_GROUPS.marketing,
      name: 'Marketing',
      description: 'Marketing and communications team',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_GROUPS.support,
      name: 'Support',
      description: 'Customer support team',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SEED_GROUPS.management,
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
