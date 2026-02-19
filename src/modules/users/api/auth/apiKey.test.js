import { authenticate } from './apiKey';

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
    };
    req = {
      app: {
        get: jest.fn(key => {
          if (key === 'models') return modelsMock;
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
});
