/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Run the seed
 */
export async function up(_, { app }) {
  const { Group } = app.get('models');

  // Get seed groups from container
  const SEED_GROUPS = app.get('container').resolve('groups:seed_constants');

  const groups = [
    {
      id: SEED_GROUPS.engineering,
      name: 'Engineering',
      description: 'Engineering and development team',
      is_active: true,
    },
    {
      id: SEED_GROUPS.marketing,
      name: 'Marketing',
      description: 'Marketing and communications team',
      is_active: true,
    },
    {
      id: SEED_GROUPS.support,
      name: 'Support',
      description: 'Customer support team',
      is_active: true,
    },
    {
      id: SEED_GROUPS.management,
      name: 'Management',
      description: 'Management and leadership team',
      is_active: true,
    },
  ];

  await Group.bulkCreate(groups);
}

/**
 * Revert the seed
 */
export async function down(_, { app }) {
  const { Group } = app.get('models');

  // Get seed groups from container
  const SEED_GROUPS = app.get('container').resolve('groups:seed_constants');

  // Remove all seeded groups by id
  await Group.destroy({
    where: {
      id: Object.values(SEED_GROUPS),
    },
    force: true, // Hard delete
  });
}
