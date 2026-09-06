/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { authenticate } from './index.js';

describe('authenticate', () => {
  let req;
  let jwtMock;
  let modelsMock;
  const token = 'api-key-token';
  const payload = { type: 'api_key' };
  const verifiedPayload = { jti: 'key-id', id: 123 };

  beforeEach(() => {
    jwtMock = {
      verifyToken: jest.fn().mockReturnValue(verifiedPayload),
    };
    modelsMock = {
      UserApiKey: {
        findOne: jest.fn(),
      },
      User: {
        findByPk: jest.fn().mockResolvedValue({
          id: 123,
          is_active: true,
          is_locked: false,
          locked_until: null,
          token_version: 0,
        }),
      },
    };
    req = {
      app: {
        get: jest.fn(key => {
          if (key === 'container') {
            return {
              has: name => name === 'models',
              resolve: name => {
                if (name === 'models') return modelsMock;
                return null;
              },
            };
          }
          return null;
        }),
      },
    };
  });

  test('should authenticate valid API key', async () => {
    const apiKeyRecord = {
      id: 'key-id',
      user_id: 123,
      is_active: true,
      update: jest.fn().mockResolvedValue(true),
    };
    modelsMock.UserApiKey.findOne.mockResolvedValue(apiKeyRecord);

    await authenticate(req, { jwt: jwtMock, token, payload });

    expect(modelsMock.UserApiKey.findOne).toHaveBeenCalledWith({
      where: {
        id: 'key-id',
        user_id: 123,
        is_active: true,
      },
    });
    expect(apiKeyRecord.update).toHaveBeenCalled();

    expect(req.user).toEqual(verifiedPayload);
    expect(req.authMethod).toBe('api_key');
    expect(req.apiKey).toEqual(apiKeyRecord);
  });

  test('should throw error if API key not found', async () => {
    modelsMock.UserApiKey.findOne.mockResolvedValue(null);

    await expect(
      authenticate(req, { jwt: jwtMock, token, payload }),
    ).rejects.toThrow('Invalid or revoked API Key');
  });

  test('should throw error if API key expired', async () => {
    const apiKeyRecord = {
      expires_at: new Date(Date.now() - 10000), // expired
    };
    modelsMock.UserApiKey.findOne.mockResolvedValue(apiKeyRecord);

    await expect(
      authenticate(req, { jwt: jwtMock, token, payload }),
    ).rejects.toThrow('API Key expired');
  });

  describe('owner state', () => {
    let apiKeyRecord;

    beforeEach(() => {
      apiKeyRecord = {
        id: 'key-id',
        user_id: 123,
        is_active: true,
        update: jest.fn().mockResolvedValue(true),
      };
      modelsMock.UserApiKey.findOne.mockResolvedValue(apiKeyRecord);
    });

    it.each([
      ['deactivated', { is_active: false }],
      ['locked by an admin', { is_locked: true }],
      ['locked by failed logins', { locked_until: new Date(Date.now() + 6e4) }],
    ])('refuses a key whose owner is %s', async (_label, overrides) => {
      modelsMock.User.findByPk.mockResolvedValue({
        id: 123,
        is_active: true,
        is_locked: false,
        locked_until: null,
        token_version: 0,
        ...overrides,
      });

      await expect(
        authenticate(req, { jwt: jwtMock, token, payload }),
      ).rejects.toMatchObject({ code: 'API_KEY_OWNER_INACTIVE', status: 401 });
      expect(apiKeyRecord.update).not.toHaveBeenCalled();
    });

    it('refuses a key whose owner no longer exists', async () => {
      modelsMock.User.findByPk.mockResolvedValue(null);

      await expect(
        authenticate(req, { jwt: jwtMock, token, payload }),
      ).rejects.toMatchObject({ code: 'API_KEY_OWNER_INACTIVE' });
    });

    it('refuses a key stamped with a superseded token_version', async () => {
      jwtMock.verifyToken.mockReturnValue({ jti: 'key-id', id: 123, ver: 1 });
      modelsMock.User.findByPk.mockResolvedValue({
        id: 123,
        is_active: true,
        is_locked: false,
        locked_until: null,
        token_version: 2,
      });

      await expect(
        authenticate(req, { jwt: jwtMock, token, payload }),
      ).rejects.toMatchObject({ code: 'SESSION_SUPERSEDED' });
    });
  });
});
