/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';
import { demoUserIds } from './2025.11.26T00.00.00.demo-users';
import { demoRoleIds } from './2025.11.26T00.03.00.demo-roles';

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;

  const now = new Date();

  const userRoles = [
    // Admin user - admin role
    {
      id: uuidv4(),
      user_id: demoUserIds.admin,
      role_id: demoRoleIds.admin,
      created_at: now,
      updated_at: now,
    },

    // John - user and editor roles
    {
      id: uuidv4(),
      user_id: demoUserIds.john,
      role_id: demoRoleIds.user,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      user_id: demoUserIds.john,
      role_id: demoRoleIds.editor,
      created_at: now,
      updated_at: now,
    },

    // Jane - user and moderator roles
    {
      id: uuidv4(),
      user_id: demoUserIds.jane,
      role_id: demoRoleIds.user,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      user_id: demoUserIds.jane,
      role_id: demoRoleIds.mod,
      created_at: now,
      updated_at: now,
    },

    // Locked user - viewer role only
    {
      id: uuidv4(),
      user_id: demoUserIds.locked,
      role_id: demoRoleIds.viewer,
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
