/**
 * Seed: Demo User Profiles
 *
 * This seed creates user profiles for the demo users.
 */

import { demoUserIds } from './2025.11.26T00.00.00.demo-users';

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;

  const now = new Date();

  const profiles = [
    {
      user_id: demoUserIds.admin,
      display_name: 'System Administrator',
      picture: 'https://i.pravatar.cc/150?img=1',
      gender: 'prefer not to say',
      location: 'San Francisco, CA',
      website: 'https://example.com',
      bio: 'System administrator with full access to all features.',
      created_at: now,
      updated_at: now,
    },
    {
      user_id: demoUserIds.john,
      display_name: 'John Doe',
      picture: 'https://i.pravatar.cc/150?img=12',
      gender: 'male',
      location: 'New York, NY',
      website: 'https://johndoe.dev',
      bio: 'Software developer and tech enthusiast. Love building amazing web applications.',
      created_at: now,
      updated_at: now,
    },
    {
      user_id: demoUserIds.jane,
      display_name: 'Jane Smith',
      picture: 'https://i.pravatar.cc/150?img=5',
      gender: 'female',
      location: 'Los Angeles, CA',
      website: 'https://janesmith.design',
      bio: 'Designer and creative director. Passionate about user experience and visual design.',
      created_at: now,
      updated_at: now,
    },
    {
      user_id: demoUserIds.locked,
      display_name: 'Locked User',
      picture: 'https://i.pravatar.cc/150?img=8',
      gender: null,
      location: null,
      website: null,
      bio: 'This account has been locked due to security reasons.',
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('user_profiles', profiles);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const { queryInterface } = context;

  // Remove all seeded profiles by userId
  await queryInterface.bulkDelete('user_profiles', {
    user_id: Object.values(demoUserIds),
  });
}
