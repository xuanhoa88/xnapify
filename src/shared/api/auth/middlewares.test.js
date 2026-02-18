import { requireAuthMiddleware } from './middlewares';

describe('requireAuthMiddleware', () => {
  let req, res, next;
  let jwtMock, modelsMock;

  beforeEach(() => {
    req = {
      headers: {},
      cookies: {},
      query: {},
      app: {
        get: jest.fn(),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    jwtMock = {
      decodeToken: jest.fn(),
      verifyToken: jest.fn(),
      verifyTypedToken: jest.fn(),
    };

    modelsMock = {
      UserApiKey: {
        findOne: jest.fn(),
      },
    };

    req.app.get.mockImplementation(key => {
      if (key === 'jwt') return jwtMock;
      if (key === 'models') return modelsMock;
      return null;
    });
  });

  // Helper to simulate request with token
  const withToken = token => {
    req.headers.authorization = `Bearer ${token}`;
  };

  test('should return 401 if no token provided', async () => {
    const middleware = requireAuthMiddleware();
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TOKEN_REQUIRED',
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  describe('Standard User Flow (JWT)', () => {
    test('should authenticate valid user token', async () => {
      const token = 'valid-user-token';
      const decodedUser = { id: 1, type: 'access' };

      withToken(token);
      jwtMock.decodeToken.mockReturnValue({ payload: { type: 'access' } });
      jwtMock.verifyTypedToken.mockReturnValue(decodedUser);

      const middleware = requireAuthMiddleware();
      await middleware(req, res, next);

      expect(jwtMock.verifyTypedToken).toHaveBeenCalledWith(token, 'access');
      expect(req.user).toEqual(decodedUser);
      expect(req.authMethod).toBe('jwt');
      expect(req.authenticated).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    test('should fail if verifyTypedToken throws', async () => {
      const token = 'invalid-token';
      withToken(token);
      jwtMock.decodeToken.mockReturnValue({ payload: { type: 'access' } });
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      jwtMock.verifyTypedToken.mockImplementation(() => {
        throw error;
      });

      const middleware = requireAuthMiddleware();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TOKEN_INVALID',
        }),
      );
    });
  });

  describe('API Key Flow', () => {
    const apiKeyToken = 'api-key-token';
    const jti = 'key-id';
    const userId = 123;
    const decodedKey = { jti, id: userId, type: 'api_key' };

    beforeEach(() => {
      withToken(apiKeyToken);
      jwtMock.decodeToken.mockReturnValue({ payload: { type: 'api_key' } });

      // Mock strategy
      const mockStrategy = jest.fn().mockResolvedValue({
        user: decodedKey,
        authMethod: 'api_key',
        apiKey: { id: jti },
      });
      req.app.get.mockImplementation(key => {
        if (key === 'jwt') return jwtMock;
        if (key === 'auth.strategy.api_key') return mockStrategy;
        return null;
      });
    });

    test('should delegate to registered strategy', async () => {
      const middleware = requireAuthMiddleware();
      await middleware(req, res, next);

      const strategy = req.app.get('auth.strategy.api_key');
      expect(strategy).toHaveBeenCalledWith(
        req,
        apiKeyToken,
        { type: 'api_key' },
        { jwt: jwtMock },
      );
      expect(req.user).toEqual(decodedKey);
      expect(req.authMethod).toBe('api_key');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('includeUser = false', () => {
    test('should NOT verify token and NOT set authenticated=true', async () => {
      const token = 'any-token';
      withToken(token);

      const middleware = requireAuthMiddleware({ includeUser: false });
      await middleware(req, res, next);

      expect(jwtMock.verifyToken).not.toHaveBeenCalled();
      expect(jwtMock.verifyTypedToken).not.toHaveBeenCalled();

      expect(req.token).toBe(token);
      // New behavior:
      expect(req.authMethod).toBe('token'); // or whatever fallback we decide
      expect(req.authenticated).toBeUndefined(); // or false/null, but definitely not true
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should preserve existing error status (e.g. 500 from DB)', async () => {
      const token = 'valid-token';
      withToken(token);
      jwtMock.decodeToken.mockReturnValue({ payload: { type: 'api_key' } });

      const dbError = new Error('DB Connection Failed');
      dbError.status = 500;

      const mockStrategy = jest.fn().mockRejectedValue(dbError);
      req.app.get.mockImplementation(key => {
        if (key === 'jwt') return jwtMock;
        if (key === 'auth.strategy.api_key') return mockStrategy;
        return null;
      });

      const middleware = requireAuthMiddleware();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'DB Connection Failed',
        }),
      );
    });

    test('should use 401 if error status is missing', async () => {
      const token = 'valid-token';
      withToken(token);
      // Force an error without status
      jwtMock.decodeToken.mockImplementation(() => {
        throw new Error('Random check fail');
      });

      const middleware = requireAuthMiddleware();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
