/**
 * Seed: Demo Users
 *
 * This seed creates demo user accounts for development/testing.
 * Includes users with different statuses and configurations.
 */

import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '../utils/password';

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
export async function up({ context }) {
  const { queryInterface } = context;

  const now = new Date();

  // Note: In a real application, you would hash these passwords with PBKDF2
  // This is just for demonstration purposes
  const users = [
    {
      id: demoUserIds.admin,
      email: 'admin@example.com',
      email_confirmed: true,
      password: await hashPassword('admin123'),
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_at: now,
      password_changed_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: demoUserIds.john,
      email: 'john.doe@example.com',
      email_confirmed: true,
      password: await hashPassword('password123'),
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_at: new Date(now.getTime() - 86400000), // 1 day ago
      password_changed_at: new Date(now.getTime() - 2592000000), // 30 days ago
      created_at: new Date(now.getTime() - 7776000000), // 90 days ago
      updated_at: now,
      deleted_at: null,
    },
    {
      id: demoUserIds.jane,
      email: 'jane.smith@example.com',
      email_confirmed: true,
      password: await hashPassword('password123'),
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_at: new Date(now.getTime() - 172800000), // 2 days ago
      password_changed_at: new Date(now.getTime() - 1296000000), // 15 days ago
      created_at: new Date(now.getTime() - 5184000000), // 60 days ago
      updated_at: now,
      deleted_at: null,
    },
    {
      id: demoUserIds.locked,
      email: 'locked.user@example.com',
      email_confirmed: true,
      password: await hashPassword('demo123'),
      is_active: false,
      is_locked: true,
      failed_login_attempts: 5,
      last_login_at: new Date(now.getTime() - 604800000), // 7 days ago
      password_changed_at: new Date(now.getTime() - 5184000000), // 60 days ago
      created_at: new Date(now.getTime() - 15552000000), // 180 days ago
      updated_at: now,
      deleted_at: null,
    },
  ];

  await queryInterface.bulkInsert('users', users);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const { queryInterface } = context;

  // Remove all seeded users by email
  await queryInterface.bulkDelete('users', {
    email: [
      'admin@example.com',
      'john.doe@example.com',
      'jane.smith@example.com',
      'locked.user@example.com',
    ],
  });
}
