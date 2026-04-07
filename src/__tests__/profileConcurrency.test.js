const { setupTestDb, closeTestDb } = require('../../tools/jest/dbTest.setup');
const {
  updateUserProfile,
  getUserWithProfile,
} = require('../apps/users/api/services/profile.service');

// simple hook stub
// eslint-disable-next-line no-unused-vars
const hook = name => ({ emit: async () => {}, invoke: async () => {} });

describe('concurrent profile updates', () => {
  it('handles many simultaneous profile writes without loss', async () => {
    const db = await setupTestDb();
    const { User, Role, Group } = db.models;
    await Role.findOrCreate({
      where: { name: 'member' },
      defaults: { description: 'Member' },
    });
    await Group.findOrCreate({
      where: { name: 'default' },
      defaults: { description: 'Default' },
    });

    const user = await User.create({
      email: 'concurrent@example.com',
      password: 'password',
      is_active: true,
    });
    const userId = user.id;

    // sanity check: user exists and count
    const initial = await db.models.User.findByPk(userId);
    expect(initial).not.toBeNull();
    const totalBefore = await db.models.User.count();
    console.log('total users before concurrent updates:', totalBefore);

    const updates = [];
    for (let i = 0; i < 50; i++) {
      updates.push(
        (async idx => {
          try {
            await updateUserProfile(
              userId,
              { profile: { counter: idx } },
              { models: db.models, hook },
            );
          } catch (err) {
            console.error('update error idx', idx, err.message);
            throw err;
          }
        })(i),
      );
    }

    await Promise.all(updates);

    const userFinal = await getUserWithProfile(userId, { models: db.models });
    // because the updates run in parallel, the order of commits is
    // non-deterministic.  we simply assert that the stored value is one of
    // the values we wrote (0–49) and that no data corruption occurred.
    expect(typeof userFinal.profile.counter).toBe('number');
    expect(userFinal.profile.counter).toBeGreaterThanOrEqual(0);
    expect(userFinal.profile.counter).toBeLessThan(50);

    await closeTestDb(db.sequelize);
  });
});
