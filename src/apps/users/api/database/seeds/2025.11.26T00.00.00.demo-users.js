/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

// Store user IDs for use in other seeds
export const demoUserIds = {
  admin: uuidv4(),
  john: uuidv4(),
  jane: uuidv4(),
  locked: uuidv4(),
};

/**
 * Run the seed
 */
export async function up(_, { app }) {
  const now = new Date();

  // Get User model from the container
  const { User } = app.get('models');

  // Passwords will be automatically hashed by beforeBulkCreate hook
  const users = [
    {
      id: demoUserIds.admin,
      email: 'admin@example.com',
      email_confirmed: true,
      password: 'admin123', // Plain text - will be hashed by hook
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_at: now,
      password_changed_at: now,
    },
    {
      id: demoUserIds.john,
      email: 'john.doe@example.com',
      email_confirmed: true,
      password: 'password123', // Plain text - will be hashed by hook
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_at: new Date(now.getTime() - 86400000), // 1 day ago
      password_changed_at: new Date(now.getTime() - 2592000000), // 30 days ago
    },
    {
      id: demoUserIds.jane,
      email: 'jane.smith@example.com',
      email_confirmed: true,
      password: 'password123', // Plain text - will be hashed by hook
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_at: new Date(now.getTime() - 172800000), // 2 days ago
      password_changed_at: new Date(now.getTime() - 1296000000), // 15 days ago
    },
    {
      id: demoUserIds.locked,
      email: 'locked.user@example.com',
      email_confirmed: true,
      password: 'demo123', // Plain text - will be hashed by hook
      is_active: false,
      is_locked: true,
      failed_login_attempts: 5,
      last_login_at: new Date(now.getTime() - 604800000), // 7 days ago
      password_changed_at: new Date(now.getTime() - 5184000000), // 60 days ago
    },
  ];

  await User.bulkCreate(users);
}

/**
 * Revert the seed
 */
export async function down(_, { app }) {
  // Get User model from the container
  const { User } = app.get('models');

  // Remove all seeded users by email
  await User.destroy({
    where: {
      email: [
        'admin@example.com',
        'john.doe@example.com',
        'jane.smith@example.com',
        'locked.user@example.com',
      ],
    },
    force: true, // Hard delete (bypass paranoid)
  });
}
