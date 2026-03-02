/**
 * User services performance benchmarks
 *
 * Measures cost of fetching user with nested associations and
 * listing users with search filters to catch potential N+1 or
 * heavy query patterns.
 *
 * Run via: npm run benchmark
 */

const { performance } = require('perf_hooks');

// allow longer execution since database operations may take a few seconds
jest.setTimeout(30000);
const { setupTestDb, closeTestDb } = require('../../tools/jest/dbTest.setup');
const {
  getUserWithProfile,
} = require('../apps/users/api/services/profile.service');
const {
  getUserList,
} = require('../apps/users/api/services/admin/user.service');

// helper to create a dummy user with profile/roles/groups
async function createUserWithRelations(models, idx) {
  const { User, UserProfile, Role, Group } = models;
  const email = `user${idx}@example.com`;
  const user = await User.create({
    email,
    password: 'password',
    is_active: true,
  });

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

  async function prepare(numUsers = 500) {
    const db = await setupTestDb();
    const { Role, Group } = db.models;
    await Role.findOrCreate({
      where: { name: 'member' },
      defaults: { description: 'Member role' },
    });
    await Group.findOrCreate({
      where: { name: 'default' },
      defaults: { description: 'Default group' },
    });

    const promises = [];
    for (let i = 1; i <= numUsers; i++) {
      promises.push(createUserWithRelations(db.models, i));
    }
    await Promise.all(promises);

    const totalUsers = await db.models.User.count();
    console.log(`\n  seeded ${totalUsers} users`);
    return db;
  }

  it('fetch user with profile/roles/groups quickly', async () => {
    const db = await prepare();
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

    await closeTestDb();
  });

  it('list users with search/filter performance', async () => {
    const db = await prepare();
    const { models } = db;
    const options = { page: 1, limit: 50, search: 'user' };
    // eslint-disable-next-line no-unused-vars
    const ctx = { models, hook: name => ({ emit: async () => {} }) };
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

    await closeTestDb();
  });
});
