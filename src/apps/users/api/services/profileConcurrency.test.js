const { updateUserProfile, getUserWithProfile } = require('./profile.service');

// Simple unique ID generator for tests
let testIdCounter = 0;
const generateTestId = () => `test-user-${Date.now()}-${++testIdCounter}`;

// simple hook stub
const hook = () => ({ emit: async () => {}, invoke: async () => {} });

describe('concurrent profile updates', () => {
  it('handles many simultaneous profile writes without loss', async () => {
    const { models } = globalThis.testDb;
    const { Role, Group } = models;
    await Role.findOrCreate({
      where: { name: 'member' },
      defaults: { description: 'Member' },
    });
    await Group.findOrCreate({
      where: { name: 'default' },
      defaults: { description: 'Default' },
    });

    const user = await models.User.create({
      id: generateTestId(),
      email: 'concurrent@example.com',
      password: 'password',
      is_active: true,
    });
    const userId = user.id;

    // sanity check: user exists
    const initial = await models.User.findByPk(userId);
    expect(initial).not.toBeNull();

    const updates = [];
    for (let i = 0; i < 50; i++) {
      updates.push(
        (async idx => {
          try {
            await updateUserProfile(
              userId,
              { profile: { counter: idx } },
              { models, hook },
            );
          } catch (err) {
            console.error('update error idx', idx, err.message);
            throw err;
          }
        })(i),
      );
    }

    await Promise.all(updates);

    const userFinal = await getUserWithProfile(userId, { models });
    // because the updates run in parallel, the order of commits is
    // non-deterministic.  we simply assert that the stored value is one of
    // the values we wrote (0–49) and that no data corruption occurred.
    expect(typeof userFinal.profile.counter).toBe('number');
    expect(userFinal.profile.counter).toBeGreaterThanOrEqual(0);
    expect(userFinal.profile.counter).toBeLessThan(50);
  });
});
