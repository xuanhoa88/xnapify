/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Run the seed
 */
export async function up(_, { app }) {
  const now = new Date();

  // Get User and UserProfile models from the container
  const { User, UserProfile } = app.get('models');

  // Get seed constants from the container
  const SEED_USERS = app.get('container').resolve('users:seed_constants');

  // Passwords will be automatically hashed by beforeBulkCreate hook
  const users = [
    {
      id: SEED_USERS.admin,
      email: `admin@example.com`,
      email_confirmed: true,
      password: 'admin123', // Plain text - will be hashed by hook
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_at: now,
      password_changed_at: now,
      profile: {
        display_name: 'System Administrator',
        picture: 'https://i.pravatar.cc/150?img=1',
        gender: 'prefer not to say',
        location: 'San Francisco, CA',
        website: 'https://example.com',
        bio: 'System administrator with full access to all features.',
        language: 'en',
        timezone: 'America/Los_Angeles',
        theme: 'dark',
        notifications: { email: true, push: true, sms: false },
      },
    },
    {
      id: SEED_USERS['john.doe'],
      email: `john.doe@example.com`,
      email_confirmed: true,
      password: 'password123', // Plain text - will be hashed by hook
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_at: new Date(now.getTime() - 86400000), // 1 day ago
      password_changed_at: new Date(now.getTime() - 2592000000), // 30 days ago
      profile: {
        display_name: 'John Doe',
        picture: 'https://i.pravatar.cc/150?img=12',
        gender: 'male',
        location: 'New York, NY',
        website: 'https://johndoe.dev',
        bio: 'Software developer and tech enthusiast. Love building amazing web applications.',
      },
    },
    {
      id: SEED_USERS['jane.smith'],
      email: `jane.smith@example.com`,
      email_confirmed: true,
      password: 'password123', // Plain text - will be hashed by hook
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_at: new Date(now.getTime() - 172800000), // 2 days ago
      password_changed_at: new Date(now.getTime() - 1296000000), // 15 days ago
      profile: {
        display_name: 'Jane Smith',
        picture: 'https://i.pravatar.cc/150?img=5',
        gender: 'female',
        location: 'Los Angeles, CA',
        website: 'https://janesmith.design',
        bio: 'Designer and creative director. Passionate about user experience and visual design.',
      },
    },
    {
      id: SEED_USERS['locked.user'],
      email: `locked.user@example.com`,
      email_confirmed: true,
      password: 'demo123', // Plain text - will be hashed by hook
      is_active: false,
      is_locked: true,
      failed_login_attempts: 5,
      last_login_at: new Date(now.getTime() - 604800000), // 7 days ago
      password_changed_at: new Date(now.getTime() - 5184000000), // 60 days ago
      profile: {
        display_name: 'Locked User',
        picture: 'https://i.pravatar.cc/150?img=8',
        bio: 'This account has been locked due to security reasons.',
      },
    },
  ];

  await User.bulkCreate(users, {
    // We must pass the include to correctly handle the expandProfileEAV hook logic
    include: [
      {
        model: UserProfile,
        as: 'profile',
      },
    ],
  });
}

/**
 * Revert the seed
 */
export async function down(_, { app }) {
  // Get User model from the container
  const { User } = app.get('models');

  // Get seed constants from the container
  const SEED_USERS = app.get('container').resolve('users:seed_constants');

  // Remove all seeded users by email.
  // This will cascade delete their associated user_profiles because User.associate
  // sets onDelete: 'cascade' on the UserProfile hasMany relationship.
  await User.destroy({
    where: {
      id: Object.values(SEED_USERS),
    },
    force: true, // Hard delete (bypass paranoid)
  });
}
