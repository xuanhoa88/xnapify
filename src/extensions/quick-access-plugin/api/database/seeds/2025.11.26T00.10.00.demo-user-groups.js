/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Run the seed
 */
export async function up(_, { container }) {
  const { UserGroup } = container.resolve('models');

  // Get seed constants from the container
  const SEED_GROUPS = container.resolve('groups:seed_constants');
  const SEED_USERS = container.resolve('users:seed_constants');

  const userGroups = [
    // Admin - Management and Engineering groups (multi-group membership)
    {
      id: uuidv4(),
      user_id: SEED_USERS.admin,
      group_id: SEED_GROUPS.management,
    },
    {
      id: uuidv4(),
      user_id: SEED_USERS.admin,
      group_id: SEED_GROUPS.engineering,
    },

    // John - Engineering group only
    {
      id: uuidv4(),
      user_id: SEED_USERS['john.doe'],
      group_id: SEED_GROUPS.engineering,
    },

    // Jane - Marketing and Support groups (multi-group membership)
    {
      id: uuidv4(),
      user_id: SEED_USERS['jane.smith'],
      group_id: SEED_GROUPS.marketing,
    },
    {
      id: uuidv4(),
      user_id: SEED_USERS['jane.smith'],
      group_id: SEED_GROUPS.support,
    },

    // Locked user - Support group only
    {
      id: uuidv4(),
      user_id: SEED_USERS['locked.user'],
      group_id: SEED_GROUPS.support,
    },
  ];

  await UserGroup.bulkCreate(userGroups);
}

/**
 * Revert the seed
 */
export async function down(_, { container }) {
  const { UserGroup } = container.resolve('models');

  // Get seed constants from the container
  const SEED_USERS = container.resolve('users:seed_constants');

  // Remove all seeded user groups by userId
  await UserGroup.destroy({
    where: {
      user_id: Object.values(SEED_USERS),
    },
    force: true, // Hard delete
  });
}
