/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Default organisational groups — seeded on first run.
 * These represent standard enterprise departments and are referenced
 * by group-role mappings and user-group assignments.
 */
export async function up(_, { container }) {
  const { Group } = container.resolve('models');
  const SEED_GROUPS = container.resolve('groups:seed_constants');

  const groups = [
    {
      id: SEED_GROUPS.engineering,
      name: 'Engineering',
      description:
        'Software engineering, DevOps, and platform reliability teams.',
      is_active: true,
    },
    {
      id: SEED_GROUPS.marketing,
      name: 'Marketing',
      description:
        'Brand strategy, growth marketing, and communications teams.',
      is_active: true,
    },
    {
      id: SEED_GROUPS.support,
      name: 'Customer Support',
      description:
        'Tier-1/2 customer support, escalation, and knowledge-base maintenance.',
      is_active: true,
    },
    {
      id: SEED_GROUPS.management,
      name: 'Management',
      description:
        'Executive leadership, department heads, and programme management.',
      is_active: true,
    },
  ];

  await Group.bulkCreate(groups);
}

/**
 * Revert the seed
 */
export async function down(_, { container }) {
  const { Group } = container.resolve('models');
  const SEED_GROUPS = container.resolve('groups:seed_constants');

  await Group.destroy({
    where: { id: Object.values(SEED_GROUPS) },
    force: true,
  });
}
