/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * User services performance benchmarks
 *
 * Measures cost of fetching user with nested associations and
 * listing users with search filters to catch potential N+1 or
 * heavy query patterns.
 *
 * Run via: npm run test:benchmark
 */

import { performance } from 'perf_hooks';

import { getUserList } from '../apps/users/api/services/admin/user.service.js';
import { getUserWithProfile } from '../apps/users/api/services/profile.service.js';

// allow longer execution since database operations may take a few seconds
jest.setTimeout(30000);

// helper to create a dummy user with profile/roles/groups
async function createUserWithRelations(models, idx) {
  const { User, UserProfile, Role, Group } = models;
  const email = `user_${Date.now()}_${Math.random()}@example.com`;
  let user;
  try {
    user = await User.create({
      email,
      password: 'password',
      is_active: true,
    });
  } catch (err) {
    console.error('CREATE USER FAILED:', err.message, err.name, err.errors);
    console.log('Index:', idx);
    throw err;
  }

  // profile entries
  await UserProfile.bulkCreate([
    {
      user_id: user.id,
      attribute_key: 'first_name',
      attribute_value: 'First' + idx,
    },
    {
      user_id: user.id,
      attribute_key: 'last_name',
      attribute_value: 'Last' + idx,
    },
    {
      user_id: user.id,
      attribute_key: 'display_name',
      attribute_value: 'User ' + idx,
    },
  ]);

  // role and group are created once before seeding; look them up here
  const role = await Role.findOne({ where: { name: 'member' } });
  if (role) {
    await user.addRole(role);
  }

  const group = await Group.findOne({ where: { name: 'default' } });
  if (group) {
    await user.addGroup(group);
  }

  return user;
}

describe('users.benchmark', () => {
  // Each test manages its own in-memory database instance so that
  // jest's test runner cannot inadvertently clear state between hooks.

  async function prepare(numUsers = 50) {
    const db = globalThis.testDb;

    const { Role, Group } = db.models;
    await Role.findOrCreate({
      where: { name: 'member' },
      defaults: { description: 'Member role' },
    });
    await Group.findOrCreate({
      where: { name: 'default' },
      defaults: { description: 'Default group' },
    });

    for (let i = 1; i <= numUsers; i++) {
      await createUserWithRelations(db.models, i);
    }

    const totalUsers = await db.models.User.count();
    console.log(`\n  seeded ${totalUsers} users`);
    return db;
  }

  let db;
  beforeEach(async () => {
    db = await prepare(50);
  });

  it('fetch user with profile/roles/groups quickly', async () => {
    const { models } = db;
    const count = 100;

    const user = await models.User.findOne();
    const targetId = user.id;

    const start = performance.now();
    for (let i = 0; i < count; i++) {
      await getUserWithProfile(targetId, { models });
    }
    const duration = performance.now() - start;
    const tps = count / (duration / 1000);
    console.log(
      `\n  getUserWithProfile: ${duration.toFixed(1)}ms (${tps.toFixed(0)} calls/sec)`,
    );
    expect(tps).toBeGreaterThan(100);
  });

  it('list users with search/filter performance', async () => {
    const { models } = db;
    const options = { page: 1, limit: 50, search: 'user' };
    const ctx = {
      models,
      hook: () => ({ emit: async () => {}, invoke: async () => {} }),
    };
    const count = 50;
    const start = performance.now();
    for (let i = 0; i < count; i++) {
      await getUserList(options, ctx);
    }
    const duration = performance.now() - start;
    const tps = count / (duration / 1000);
    console.log(
      `\n  getUserList: ${duration.toFixed(1)}ms (${tps.toFixed(0)} calls/sec)`,
    );
    expect(tps).toBeGreaterThan(10);
  });
});
