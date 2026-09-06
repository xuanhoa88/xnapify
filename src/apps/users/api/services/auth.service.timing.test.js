/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { verifyPassword } from '../utils/password.js';

import { authenticateUser } from './auth.service.js';

jest.mock('../utils/password', () => ({
  createTimedResetToken: jest.fn(),
  hashToken: jest.fn(),
  validateResetToken: jest.fn(),
  verifyPassword: jest.fn(),
}));

const hook = () => ({ emit: async () => {}, invoke: async () => {} });

const missingUserModels = () => ({
  User: { scope: () => ({ findOne: async () => null }) },
  UserProfile: {},
  Role: {},
  Group: {},
  Permission: {},
});

// `password` is null for an OAuth-only account (see oauthLogin in this
// service) — a second way for the login endpoint to answer differently for
// an address that exists.
const oauthOnlyUserModels = () => ({
  User: {
    scope: () => ({
      findOne: async () => ({
        id: 'user-1',
        email: 'oauth@example.com',
        password: null,
        is_active: true,
        is_locked: false,
        locked_until: null,
        failed_login_attempts: 0,
        async update(fields) {
          Object.assign(this, fields);
        },
      }),
    }),
  },
  UserProfile: {},
  Role: {},
  Group: {},
  Permission: {},
});

describe('authenticateUser unknown-email timing', () => {
  beforeEach(() => {
    // resetMocks clears the factory implementations before every test
    verifyPassword.mockResolvedValue(false);
  });

  // Wall-clock timing is not asserted — it would be flaky in CI. The spy is
  // the stand-in: one scrypt on the missing-user path is what makes it cost
  // the same as the path where the row exists.
  it('still verifies a password when the email matches no row', async () => {
    await expect(
      authenticateUser('nobody@example.com', 'hunter2', {
        models: missingUserModels(),
        hook,
      }),
    ).rejects.toMatchObject({ name: 'UserNotFoundError', status: 404 });

    expect(verifyPassword).toHaveBeenCalledTimes(1);

    const [, hashedPassword] = verifyPassword.mock.calls[0];
    expect(hashedPassword).toMatch(/^[0-9a-f]{64}:[0-9a-f]{128}$/);
  });

  // The controller folds UserNotFoundError and InvalidCredentialsError onto
  // one 401 body by name; anything else there leaks the distinction again.
  it('keeps the error name and status the controller maps on', async () => {
    const error = await authenticateUser('nobody@example.com', 'hunter2', {
      models: missingUserModels(),
      hook,
    }).catch(e => e);

    expect(error.name).toBe('UserNotFoundError');
    expect(error.status).toBe(404);
  });

  // A malformed dummy hash makes the real verifyPassword throw
  // InvalidPasswordHashFormatError, which would answer an unknown email with
  // a 400 while a known one still answers 401 — a plainer oracle than the
  // one the dummy closes.
  it('uses a dummy hash the real verifyPassword accepts', async () => {
    const { verifyPassword: realVerifyPassword } = jest.requireActual(
      '../utils/password.js',
    );

    await authenticateUser('nobody@example.com', 'hunter2', {
      models: missingUserModels(),
      hook,
    }).catch(() => {});

    const [, hashedPassword] = verifyPassword.mock.calls[0];
    await expect(realVerifyPassword('hunter2', hashedPassword)).resolves.toBe(
      false,
    );
  });

  // Regression: `verifyPassword(password, user.password)` with a null
  // `user.password` reaches the real implementation's `null.split(':')` and
  // throws a raw TypeError. That name matches none of the controller's known
  // error branches, so it falls through to a 500 — a louder oracle than the
  // timing gap this file closes, since an OAuth-registered address would be
  // told apart from every other outcome by status code alone, instantly.
  it('does not hand an OAuth account’s null password to verifyPassword', async () => {
    await expect(
      authenticateUser('oauth@example.com', 'hunter2', {
        models: oauthOnlyUserModels(),
        hook,
      }),
    ).rejects.toMatchObject({ name: 'InvalidCredentialsError', status: 401 });

    expect(verifyPassword).toHaveBeenCalledTimes(1);
    const [, hashedPassword] = verifyPassword.mock.calls[0];
    expect(hashedPassword).not.toBeNull();
    expect(hashedPassword).toMatch(/^[0-9a-f]{64}:[0-9a-f]{128}$/);
  });
});
