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
export async function up({ context }) {
  const { queryInterface } = context;

  const now = new Date();

  const logins = [
    {
      id: uuidv4(),
      user_id: demoUserIds.john,
      name: 'google',
      key: 'google-oauth-id-123456',
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      user_id: demoUserIds.john,
      name: 'github',
      key: 'github-oauth-id-789012',
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      user_id: demoUserIds.jane,
      name: 'google',
      key: 'google-oauth-id-345678',
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      user_id: demoUserIds.jane,
      name: 'facebook',
      key: 'facebook-oauth-id-901234',
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('user_logins', logins);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const { queryInterface } = context;

  // Remove all seeded logins by userId
  await queryInterface.bulkDelete('user_logins', {
    user_id: Object.values(demoUserIds),
  });
}
