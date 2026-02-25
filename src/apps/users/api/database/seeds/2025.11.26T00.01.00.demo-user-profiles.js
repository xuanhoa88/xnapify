/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { demoUserIds } from './2025.11.26T00.00.00.demo-users';

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;

  const now = new Date();

  const profilesRaw = [
    {
      user_id: demoUserIds.admin,
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
    {
      user_id: demoUserIds.john,
      display_name: 'John Doe',
      picture: 'https://i.pravatar.cc/150?img=12',
      gender: 'male',
      location: 'New York, NY',
      website: 'https://johndoe.dev',
      bio: 'Software developer and tech enthusiast. Love building amazing web applications.',
    },
    {
      user_id: demoUserIds.jane,
      display_name: 'Jane Smith',
      picture: 'https://i.pravatar.cc/150?img=5',
      gender: 'female',
      location: 'Los Angeles, CA',
      website: 'https://janesmith.design',
      bio: 'Designer and creative director. Passionate about user experience and visual design.',
    },
    {
      user_id: demoUserIds.locked,
      display_name: 'Locked User',
      picture: 'https://i.pravatar.cc/150?img=8',
      gender: null,
      location: null,
      website: null,
      bio: 'This account has been locked due to security reasons.',
    },
  ];

  const profiles = [];

  for (const profile of profilesRaw) {
    const { user_id, ...attributes } = profile;
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== null && value !== undefined) {
        profiles.push({
          user_id,
          attribute_key: key,
          attribute_value:
            typeof value === 'object' ? JSON.stringify(value) : String(value),
          attribute_type: typeof value === 'object' ? 'json' : 'string',
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

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
