import { requireAuthMiddleware, optionalAuthMiddleware } from './middlewares';

describe('requireAuthMiddleware', () => {
  let req, res, next;
  let jwtMock, modelsMock, hookMock;

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

    hookMock = {
      emit: jest.fn(),
      has: jest.fn(),
    };

    req.app.get.mockImplementation(key => {
      if (key === 'jwt') return jwtMock;
      if (key === 'models') return modelsMock;
      if (key === 'hook') return hookMock;
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

      // Mock hook
      hookMock.has.mockReturnValue(true);
      hookMock.emit.mockImplementation(async (event, req) => {
        Object.assign(req, {
          user: decodedKey,
          authMethod: 'api_key',
          apiKey: { id: jti },
        });
      });
    });

    test('should delegate to registered strategy', async () => {
      const middleware = requireAuthMiddleware();
      await middleware(req, res, next);

      expect(hookMock.has).toHaveBeenCalledWith('auth.strategy.api_key');
      expect(hookMock.emit).toHaveBeenCalledWith('auth.strategy.api_key', req, {
        jwt: jwtMock,
        payload: { type: 'api_key' },
        token: apiKeyToken,
      });
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

      hookMock.has.mockReturnValue(true);
      hookMock.emit.mockRejectedValue(dbError);

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

describe('optionalAuthMiddleware', () => {
  let req, res, next;
  let jwtMock, hookMock;

  beforeEach(() => {
    req = {
      headers: {},
      cookies: {},
      query: {},
      app: {
        get: jest.fn(),
      },
    };
    res = {};
    next = jest.fn();

    jwtMock = {
      decodeToken: jest.fn(),
      verifyTypedToken: jest.fn(),
    };

    hookMock = {
      emit: jest.fn(),
      has: jest.fn(),
    };

    req.app.get.mockImplementation(key => {
      if (key === 'jwt') return jwtMock;
      if (key === 'hook') return hookMock;
      return null;
    });
  });

  const withToken = token => {
    req.headers.authorization = `Bearer ${token}`;
  };

  test('should pass through if no token provided', async () => {
    const middleware = optionalAuthMiddleware();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.authenticated).toBeUndefined();
  });

  test('should authenticate valid user token', async () => {
    const token = 'valid-token';
    withToken(token);
    jwtMock.decodeToken.mockReturnValue({ payload: { type: 'access' } });
    jwtMock.verifyTypedToken.mockReturnValue({ id: 1 });

    const middleware = optionalAuthMiddleware();
    await middleware(req, res, next);

    expect(req.user).toEqual({ id: 1 });
    expect(req.authenticated).toBe(true);
    expect(req.authMethod).toBe('jwt');
    expect(next).toHaveBeenCalled();
  });

  test('should support API key strategy', async () => {
    const token = 'api-key';
    withToken(token);
    jwtMock.decodeToken.mockReturnValue({ payload: { type: 'api_key' } });

    hookMock.has.mockReturnValue(true);
    hookMock.emit.mockImplementation(async (event, req) => {
      Object.assign(req, {
        user: { id: 1, type: 'api_key' },
        authMethod: 'api_key',
      });
    });

    const middleware = optionalAuthMiddleware();
    await middleware(req, res, next);

    expect(hookMock.emit).toHaveBeenCalledWith('auth.strategy.api_key', req, {
      jwt: jwtMock,
      payload: { type: 'api_key' },
      token,
    });
    expect(req.authenticated).toBe(true);
    expect(req.authMethod).toBe('api_key');
    expect(next).toHaveBeenCalled();
  });

  test('should fail gracefully if strategy fails', async () => {
    const token = 'api-key';
    withToken(token);
    jwtMock.decodeToken.mockReturnValue({ payload: { type: 'api_key' } });
  });
});
