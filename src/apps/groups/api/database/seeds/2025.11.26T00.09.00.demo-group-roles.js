/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Run the seed
 */
export async function up({ context }, { app }) {
  const { queryInterface } = context;

  // Get seed groups from container
  const container = app.get('container');
  const SEED_GROUPS = container.resolve('SEED:GROUPS');
  const SEED_ROLES = container.resolve('SEED:ROLES');

  const now = new Date();

  const groupRoles = [
    // Engineering group - editor role
    {
      id: uuidv4(),
      group_id: SEED_GROUPS.engineering,
      role_id: SEED_ROLES.editor,
      created_at: now,
      updated_at: now,
    },

    // Marketing group - user role
    {
      id: uuidv4(),
      group_id: SEED_GROUPS.marketing,
      role_id: SEED_ROLES.user,
      created_at: now,
      updated_at: now,
    },

    // Support group - moderator role
    {
      id: uuidv4(),
      group_id: SEED_GROUPS.support,
      role_id: SEED_ROLES.mod,
      created_at: now,
      updated_at: now,
    },

    // Management group - admin role
    {
      id: uuidv4(),
      group_id: SEED_GROUPS.management,
      role_id: SEED_ROLES.admin,
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
    group_id: Object.values(SEED_GROUPS),
  });
}
