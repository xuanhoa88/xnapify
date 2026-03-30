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
  const { UserRole } = container.resolve('models');

  // Get seed constants from the container
  const SEED_ROLES = container.resolve('roles:seed_constants');
  const SEED_USERS = container.resolve('users:seed_constants');

  const userRoles = [
    // Admin user - admin role
    {
      id: uuidv4(),
      user_id: SEED_USERS.admin,
      role_id: SEED_ROLES.admin,
    },

    // John - user and editor roles
    {
      id: uuidv4(),
      user_id: SEED_USERS['john.doe'],
      role_id: SEED_ROLES.user,
    },
    {
      id: uuidv4(),
      user_id: SEED_USERS['john.doe'],
      role_id: SEED_ROLES.editor,
    },

    // Jane - user and moderator roles
    {
      id: uuidv4(),
      user_id: SEED_USERS['jane.smith'],
      role_id: SEED_ROLES.user,
    },
    {
      id: uuidv4(),
      user_id: SEED_USERS['jane.smith'],
      role_id: SEED_ROLES.mod,
    },

    // Locked user - viewer role only
    {
      id: uuidv4(),
      user_id: SEED_USERS['locked.user'],
      role_id: SEED_ROLES.viewer,
    },
  ];

  await UserRole.bulkCreate(userRoles);
}

/**
 * Revert the seed
 */
export async function down(_, { container }) {
  const { UserRole } = container.resolve('models');

  // Get seed constants from the container
  const SEED_USERS = container.resolve('users:seed_constants');

  // Remove all seeded user roles by userId
  await UserRole.destroy({
    where: {
      user_id: Object.values(SEED_USERS),
    },
    force: true, // Hard delete
  });
}
