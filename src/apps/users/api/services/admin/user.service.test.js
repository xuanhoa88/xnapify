/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { resetUserPassword, updateUserById } from './user.service.js';

const hook = () => ({ emit: async () => {}, invoke: async () => {} });

describe('updateUserById', () => {
  let models;

  beforeEach(() => {
    ({ models } = globalThis.testDb);
  });

  it('clears the automatic lockout when an admin sets a new password', async () => {
    const user = await models.User.create({
      email: `admin-unlock-${Date.now()}@example.com`,
      password: 'original-password',
      is_active: true,
      is_locked: true,
      failed_login_attempts: 12,
      locked_until: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await updateUserById(
      user.id,
      { password: 'brand-new-password' },
      { models, hook, defaultRoleName: 'user' },
    );

    await user.reload();
    expect(user.is_locked).toBe(false);
    expect(user.failed_login_attempts).toBe(0);
    // Without this the "unlock" left the account locked for another 24 h
    expect(user.locked_until).toBeNull();
  });

  it('clears the automatic lockout on an admin password reset', async () => {
    const user = await models.User.create({
      email: `admin-reset-${Date.now()}@example.com`,
      password: 'original-password',
      is_active: true,
      is_locked: true,
      failed_login_attempts: 12,
      locked_until: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await resetUserPassword(user.id, 'brand-new-password', { models, hook });

    await user.reload();
    expect(user.is_locked).toBe(false);
    expect(user.failed_login_attempts).toBe(0);
    expect(user.locked_until).toBeNull();
  });
});
