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
export async function up(_, { app }) {
  const { UserLogin } = app.get('models');

  // Get seed constants from the container
  const SEED_USERS = app.get('container').resolve('users:seed_constants');

  const logins = [
    {
      id: uuidv4(),
      user_id: SEED_USERS['john.doe'],
      name: 'google',
      key: 'google-oauth-id-123456',
    },
    {
      id: uuidv4(),
      user_id: SEED_USERS['john.doe'],
      name: 'github',
      key: 'github-oauth-id-789012',
    },
    {
      id: uuidv4(),
      user_id: SEED_USERS['jane.smith'],
      name: 'google',
      key: 'google-oauth-id-345678',
    },
    {
      id: uuidv4(),
      user_id: SEED_USERS['jane.smith'],
      name: 'facebook',
      key: 'facebook-oauth-id-901234',
    },
  ];

  await UserLogin.bulkCreate(logins);
}

/**
 * Revert the seed
 */
export async function down(_, { app }) {
  const { UserLogin } = app.get('models');

  // Get seed constants from the container
  const SEED_USERS = app.get('container').resolve('users:seed_constants');

  // Remove all seeded logins by userId
  await UserLogin.destroy({
    where: {
      user_id: Object.values(SEED_USERS),
    },
    force: true, // Hard delete
  });
}
