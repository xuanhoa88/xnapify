/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { authenticateUser } from './auth.service.js';

const PASSWORD = 'correct-horse-battery';
const hook = () => ({ emit: async () => {}, invoke: async () => {} });

describe('authenticateUser lockout policy', () => {
  let models;
  let user;

  beforeEach(async () => {
    ({ models } = globalThis.testDb);
    user = await models.User.create({
      email: `lockout-${Date.now()}@example.com`,
      password: PASSWORD,
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
    });
  });

  const login = (password = PASSWORD) =>
    authenticateUser(user.email, password, { models, hook });

  it('locks the account after the threshold and lets it lapse', async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(login('wrong')).rejects.toMatchObject({
        name: 'InvalidCredentialsError',
      });
    }

    await user.reload();
    expect(user.failed_login_attempts).toBe(5);
    expect(user.locked_until).not.toBeNull();

    await expect(login()).rejects.toMatchObject({ name: 'UserLockedError' });
  });

  it('resets the counter once a lockout window has lapsed', async () => {
    // Simulate a user who already climbed to the second backoff tier and
    // waited it out.
    await user.update({
      failed_login_attempts: 9,
      locked_until: new Date(Date.now() - 1000),
    });

    // One further mistake must not immediately re-lock at the old tier
    await expect(login('wrong')).rejects.toMatchObject({
      name: 'InvalidCredentialsError',
    });

    await user.reload();
    expect(user.failed_login_attempts).toBe(1);
    expect(user.locked_until).toBeNull();
  });

  it('lets the right password back in once the lock has lapsed', async () => {
    await user.update({
      failed_login_attempts: 5,
      locked_until: new Date(Date.now() - 1000),
    });

    await expect(login()).resolves.toMatchObject({ email: user.email });

    await user.reload();
    expect(user.failed_login_attempts).toBe(0);
    expect(user.locked_until).toBeNull();
  });

  it('does not reveal a locked account to a caller with the wrong password', async () => {
    await user.update({ locked_until: new Date(Date.now() + 60_000) });

    await expect(login('wrong')).rejects.toMatchObject({
      name: 'InvalidCredentialsError',
    });
  });

  it('does not reveal an inactive account to a caller with the wrong password', async () => {
    await user.update({ is_active: false });

    await expect(login('wrong')).rejects.toMatchObject({
      name: 'InvalidCredentialsError',
    });

    // …but says so once the credentials are proven
    await expect(login()).rejects.toMatchObject({ name: 'UserInactiveError' });
  });

  // Regression: counting during an active lock let an attacker burst requests
  // inside one lock window, climb the backoff tiers to the 24 h cap and renew
  // `locked_until` indefinitely — the permanent denial of service the
  // time-boxed policy exists to prevent.
  it('freezes the counter while the account is already locked', async () => {
    const lockedUntil = new Date(Date.now() + 60_000);
    await user.update({ failed_login_attempts: 5, locked_until: lockedUntil });

    await expect(login('wrong')).rejects.toMatchObject({
      name: 'InvalidCredentialsError',
    });

    await user.reload();
    expect(user.failed_login_attempts).toBe(5);
    expect(user.locked_until.getTime()).toBe(lockedUntil.getTime());
  });

  it('cannot have its lock extended by repeated failures', async () => {
    const lockedUntil = new Date(Date.now() + 60_000);
    await user.update({ failed_login_attempts: 5, locked_until: lockedUntil });

    for (let i = 0; i < 25; i += 1) {
      await expect(login('wrong')).rejects.toMatchObject({
        name: 'InvalidCredentialsError',
      });
    }

    await user.reload();
    // Neither the tier nor the deadline moved, so the lock still lapses on
    // schedule instead of being pushed forward forever.
    expect(user.failed_login_attempts).toBe(5);
    expect(user.locked_until.getTime()).toBe(lockedUntil.getTime());
  });
});
