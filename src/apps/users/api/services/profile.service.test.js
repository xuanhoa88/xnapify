/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import { changeUserPassword } from './profile.service.js';

describe('changeUserPassword', () => {
  let models;
  let emit;
  let hook;

  beforeEach(() => {
    ({ models } = globalThis.testDb);
    emit = jest.fn().mockResolvedValue(undefined);
    hook = () => ({ emit, invoke: async () => {} });
  });

  async function createUser() {
    return models.User.create({
      email: `pwd-${Date.now()}@example.com`,
      password: 'original-password',
      is_active: true,
    });
  }

  it('names the acting session so it can be spared from revocation', async () => {
    const user = await createUser();

    await changeUserPassword(user.id, 'original-password', 'new-password-123', {
      models,
      hook,
      sessionId: 'family-42',
    });

    expect(emit).toHaveBeenCalledWith(
      'password_changed',
      expect.objectContaining({ user_id: user.id, family_id: 'family-42' }),
    );
  });

  it('reports no session when the caller has none', async () => {
    const user = await createUser();

    await changeUserPassword(user.id, 'original-password', 'new-password-123', {
      models,
      hook,
    });

    expect(emit).toHaveBeenCalledWith(
      'password_changed',
      expect.objectContaining({ family_id: null }),
    );
  });

  it('rejects a wrong current password', async () => {
    const user = await createUser();

    await expect(
      changeUserPassword(user.id, 'wrong', 'new-password-123', {
        models,
        hook,
      }),
    ).rejects.toMatchObject({ name: 'InvalidPasswordError' });
    expect(emit).not.toHaveBeenCalled();
  });
});
