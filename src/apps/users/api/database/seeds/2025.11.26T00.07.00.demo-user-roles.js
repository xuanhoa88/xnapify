/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';
import { demoUserIds } from './2025.11.26T00.00.00.demo-users';

/**
 * Run the seed
 */
export async function up({ context }, { app }) {
  const now = new Date();

  const { queryInterface } = context;

  // Get seed roles from container
  const SEED_ROLES = app.get('container').resolve('SEED:ROLES');

  const userRoles = [
    // Admin user - admin role
    {
      id: uuidv4(),
      user_id: demoUserIds.admin,
      role_id: SEED_ROLES.admin,
      created_at: now,
      updated_at: now,
    },

    // John - user and editor roles
    {
      id: uuidv4(),
      user_id: demoUserIds.john,
      role_id: SEED_ROLES.user,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      user_id: demoUserIds.john,
      role_id: SEED_ROLES.editor,
      created_at: now,
      updated_at: now,
    },

    // Jane - user and moderator roles
    {
      id: uuidv4(),
      user_id: demoUserIds.jane,
      role_id: SEED_ROLES.user,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      user_id: demoUserIds.jane,
      role_id: SEED_ROLES.mod,
      created_at: now,
      updated_at: now,
    },

    // Locked user - viewer role only
    {
      id: uuidv4(),
      user_id: demoUserIds.locked,
      role_id: SEED_ROLES.viewer,
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('user_roles', userRoles);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const { queryInterface } = context;

  // Remove all seeded user roles by userId
  await queryInterface.bulkDelete('user_roles', {
    user_id: Object.values(demoUserIds),
  });
}
