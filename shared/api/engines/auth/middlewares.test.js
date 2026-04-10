import {
  requireAuth,
  optionalAuth,
  requirePermission,
  requireAnyPermission,
  requireRole,
  requireAnyRole,
  requireRoleLevel,
  requireDynamicRole,
  requireOwnership,
  requireFlexibleOwnership,
  requireSharedOwnership,
  requireHierarchicalOwnership,
  requireTimeBasedOwnership,
  requireGroup,
  requireAnyGroup,
  requireGroupLevel,
} from './middlewares';

describe('requireAuth', () => {
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
      cache: new Map(),
      cacheToken: jest.fn((token, decoded) =>
        jwtMock.cache.set(token, decoded),
      ),
    };

    modelsMock = {
      UserApiKey: {
        findOne: jest.fn(),
      },
    };

    const channelMock = {
      invoke: jest.fn(),
      on: jest.fn(),
    };

    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn();

    req.app.get.mockImplementation(key => {
      if (key === 'container')
        return {
          resolve: name => {
            if (name === 'jwt') return jwtMock;
            if (name === 'models') return modelsMock;
            if (name === 'hook') return hookMock;
            return null;
          },
        };
      return null;
    });
  });

  // Helper to simulate request with token
  const withToken = token => {
    req.headers.authorization = `Bearer ${token}`;
  };

  test('should return 401 if no token provided', async () => {
    const middleware = requireAuth();
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

      const middleware = requireAuth();
      await middleware(req, res, next);

      expect(jwtMock.verifyTypedToken).toHaveBeenCalledWith(token, 'access');
      expect(req.user).toEqual(decodedUser);
      expect(req.authMethod).toBe('jwt');
      expect(req.authenticated).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    test('should cache verified JWT and skip second verification', async () => {
      const token = 'cached-token';
      const decodedUser = { id: 2, type: 'access' };

      withToken(token);
      jwtMock.decodeToken.mockReturnValue({ payload: { type: 'access' } });
      jwtMock.verifyTypedToken.mockReturnValue(decodedUser);

      const middleware = requireAuth();
      await middleware(req, res, next); // first call populates cache
      expect(jwtMock.verifyTypedToken).toHaveBeenCalledTimes(1);

      // Reset spies and simulate new request
      jwtMock.verifyTypedToken.mockClear();
      const req2 = { ...req, headers: { authorization: `Bearer ${token}` } };
      const middleware2 = requireAuth();
      await middleware2(req2, res, next);

      expect(jwtMock.verifyTypedToken).not.toHaveBeenCalled();
      expect(req2.user).toEqual(decodedUser);
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

      const middleware = requireAuth();
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
      hookMock().invoke.mockImplementation(async (event, req) => {
        Object.assign(req, {
          user: decodedKey,
          authMethod: 'api_key',
          apiKey: { id: jti },
        });
      });
    });

    test('should delegate to registered strategy', async () => {
      const middleware = requireAuth();
      await middleware(req, res, next);

      expect(hookMock.has).toHaveBeenCalledWith('auth.strategy.api_key');
      expect(hookMock).toHaveBeenCalledWith('auth.strategy.api_key');
      expect(hookMock().invoke).toHaveBeenCalledWith(
        'authenticate',
        req,
        expect.objectContaining({
          jwt: jwtMock,
          payload: { type: 'api_key' },
          token: apiKeyToken,
        }),
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

      const middleware = requireAuth({ includeUser: false });
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
      hookMock().invoke.mockRejectedValue(dbError);

      const middleware = requireAuth();
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

      const middleware = requireAuth();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});

describe('optionalAuth', () => {
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
      cache: new Map(),
      cacheToken: jest.fn((token, decoded) =>
        jwtMock.cache.set(token, decoded),
      ),
    };

    const channelMock = {
      invoke: jest.fn(),
      on: jest.fn(),
    };

    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn();

    req.app.get.mockImplementation(key => {
      if (key === 'container')
        return {
          resolve: name => {
            if (name === 'jwt') return jwtMock;
            if (name === 'hook') return hookMock;
            return null;
          },
        };
      return null;
    });
  });

  const withToken = token => {
    req.headers.authorization = `Bearer ${token}`;
  };

  test('should pass through if no token provided', async () => {
    const middleware = optionalAuth();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.authenticated).toBeUndefined();
  });

  test('should authenticate valid user token', async () => {
    const token = 'valid-token';
    withToken(token);
    jwtMock.decodeToken.mockReturnValue({ payload: { type: 'access' } });
    jwtMock.verifyTypedToken.mockReturnValue({ id: 1 });

    const middleware = optionalAuth();
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
    hookMock().invoke.mockImplementation(async (event, req) => {
      Object.assign(req, {
        user: { id: 1, type: 'api_key' },
        authMethod: 'api_key',
      });
    });

    const middleware = optionalAuth();
    await middleware(req, res, next);

    expect(hookMock).toHaveBeenCalledWith('auth.strategy.api_key');
    expect(hookMock().invoke).toHaveBeenCalledWith(
      'authenticate',
      req,
      expect.objectContaining({
        jwt: jwtMock,
        payload: { type: 'api_key' },
        token,
      }),
    );
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

describe('requirePermission', () => {
  let req, res, next, hookMock;

  beforeEach(() => {
    const channelMock = { invoke: jest.fn() };
    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn().mockReturnValue(false);

    req = {
      user: {},
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return hookMock;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should fail if user is not authenticated', async () => {
    req.user = undefined;
    const middleware = requirePermission('users:read');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('AuthenticationRequiredError');
  });

  test('should allow access for admin role', async () => {
    req.user.is_admin = true;
    const middleware = requirePermission('users:read');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow access if user has exact permission', async () => {
    req.user.roles = ['user'];
    req.user.permissions = ['users:read'];

    const middleware = requirePermission('users:read');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow access if user has super admin wildcard (*:*)', async () => {
    req.user.roles = ['user'];
    req.user.permissions = ['*:*'];

    const middleware = requirePermission('users:delete');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow access if user has resource wildcard (users:*)', async () => {
    req.user.roles = ['user'];
    req.user.permissions = ['users:*'];

    const middleware = requirePermission('users:delete');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny access if user lacks permission', async () => {
    req.user.roles = ['user'];
    req.user.permissions = ['users:read'];

    const middleware = requirePermission('users:delete');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  test('should deny access if user has no permissions', async () => {
    req.user.roles = ['user'];
    req.user.permissions = [];

    const middleware = requirePermission('users:read');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
  });

  test('should allow access when user has ALL required permissions (spread)', async () => {
    req.user.roles = ['user'];
    req.user.permissions = ['users:read', 'users:write'];

    const middleware = requirePermission('users:read', 'users:write');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny access when user is missing one of multiple permissions', async () => {
    req.user.roles = ['user'];
    req.user.permissions = ['users:read'];

    const middleware = requirePermission('users:read', 'users:write');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].message).toContain('users:write');
  });

  test('should invoke hook to resolve permissions when registered', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock().invoke.mockImplementation(async (event, r) => {
      r.user.permissions = ['users:read'];
    });

    req.user.roles = ['user'];
    const middleware = requirePermission('users:read');
    await middleware(req, res, next);

    expect(hookMock.has).toHaveBeenCalledWith('auth.permissions');
    expect(hookMock).toHaveBeenCalledWith('auth.permissions');
    expect(hookMock().invoke).toHaveBeenCalledWith('resolve', req);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireAnyPermission', () => {
  let req, res, next, hookMock;

  beforeEach(() => {
    const channelMock = { invoke: jest.fn() };
    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn().mockReturnValue(false);

    req = {
      user: {},
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return hookMock;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should fail if user is not authenticated', async () => {
    req.user = undefined;
    const middleware = requireAnyPermission('users:read');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('AuthenticationRequiredError');
  });

  test('should allow access for admin role', async () => {
    req.user.is_admin = true;
    const middleware = requireAnyPermission('users:read', 'users:write');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow access if user has ANY of the permissions', async () => {
    req.user.roles = ['user'];
    req.user.permissions = ['users:read'];

    const middleware = requireAnyPermission('users:read', 'users:write');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow access with wildcard matching ANY permission', async () => {
    req.user.roles = ['user'];
    req.user.permissions = ['users:*'];

    const middleware = requireAnyPermission('users:read', 'posts:write');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny access if user has NONE of the permissions', async () => {
    req.user.roles = ['user'];
    req.user.permissions = ['posts:read'];

    const middleware = requireAnyPermission('users:read', 'users:write');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
  });
});

describe('requireRole', () => {
  let req, res, next, hookMock;

  beforeEach(() => {
    const channelMock = { invoke: jest.fn() };
    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn().mockReturnValue(false);

    req = {
      user: {},
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return hookMock;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should fail if user is not authenticated', async () => {
    req.user = undefined;
    const middleware = requireRole('admin');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('AuthenticationRequiredError');
  });

  test('should allow access if user has the required role', async () => {
    req.user.roles = ['admin'];
    const middleware = requireRole('admin');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny access if user lacks the role', async () => {
    req.user.roles = ['user'];
    const middleware = requireRole('admin');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  test('should require ALL roles when multiple are specified', async () => {
    req.user.is_admin = true;
    const middleware = requireRole('admin', 'superuser');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toContain('superuser');
  });

  test('should allow when user has ALL required roles', async () => {
    req.user.roles = ['admin', 'superuser'];
    const middleware = requireRole('admin', 'superuser');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should invoke hook to resolve roles when registered', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock().invoke.mockImplementation(async (event, r) => {
      r.user.roles = ['editor'];
    });

    delete req.user.roles;
    const middleware = requireRole('editor');
    await middleware(req, res, next);

    expect(hookMock.has).toHaveBeenCalledWith('auth.roles');
    expect(hookMock).toHaveBeenCalledWith('auth.roles');
    expect(hookMock().invoke).toHaveBeenCalledWith('resolve', req);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireAnyRole', () => {
  let req, res, next, hookMock;

  beforeEach(() => {
    const channelMock = { invoke: jest.fn() };
    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn().mockReturnValue(false);

    req = {
      user: {},
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return hookMock;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should allow access if user has ANY of the roles', async () => {
    req.user.roles = ['moderator'];
    const middleware = requireAnyRole('admin', 'moderator');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny access if user has NONE of the roles', async () => {
    req.user.roles = ['user'];
    const middleware = requireAnyRole('admin', 'moderator');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
  });
});

describe('requireRoleLevel', () => {
  const HIERARCHY = ['viewer', 'editor', 'moderator', 'admin'];
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: 'user-1', roles: [] },
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return null;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should fail if user is not authenticated', async () => {
    req.user = null;
    const middleware = requireRoleLevel('editor', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  test('should allow when user role meets minimum level', async () => {
    req.user.roles = ['moderator'];
    const middleware = requireRoleLevel('moderator', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow when user role exceeds minimum level', async () => {
    req.user.roles = ['admin'];
    const middleware = requireRoleLevel('editor', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny when user role is below minimum level', async () => {
    req.user.roles = ['viewer'];
    const middleware = requireRoleLevel('moderator', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
    expect(next.mock.calls[0][0].code).toBe('ROLE_LEVEL_REQUIRED');
  });

  test('should deny when user has no roles', async () => {
    delete req.user.roles;
    const middleware = requireRoleLevel('viewer', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  test('should return 500 for invalid minimum role configuration', async () => {
    req.user.is_admin = true;
    const middleware = requireRoleLevel('nonexistent', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(500);
    expect(next.mock.calls[0][0].code).toBe('INVALID_ROLE_CONFIG');
  });

  test('should ignore user roles not in hierarchy', async () => {
    req.user.roles = ['unknown-role'];
    const middleware = requireRoleLevel('viewer', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
  });
});

describe('requireDynamicRole', () => {
  let req, res, next, hookMock;

  beforeEach(() => {
    const channelMock = { invoke: jest.fn() };
    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn().mockReturnValue(false);

    req = {
      user: { id: 'user-1', roles: [] },
      params: { id: 'p-1' },
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return hookMock;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should fail if user is not authenticated', async () => {
    req.user = null;
    const middleware = requireDynamicRole({ resolver: () => 'editor' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  test('should allow access if no roles are required (resolver returns null)', async () => {
    const middleware = requireDynamicRole({ resolver: () => null });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow access via resolver function', async () => {
    req.user.roles = ['editor'];
    const middleware = requireDynamicRole({
      resolver: () => 'editor',
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny access if user lacks resolved role', async () => {
    req.user.roles = ['viewer'];
    const middleware = requireDynamicRole({
      resolver: () => 'editor',
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
    expect(next.mock.calls[0][0].code).toBe('DYNAMIC_ROLE_REQUIRED');
  });

  test('should allow access via hook resolution', async () => {
    req.user.roles = ['admin'];
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.requiredRoles = ['admin'];
      }),
    });

    const middleware = requireDynamicRole({ resourceType: 'project' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should support async resolver', async () => {
    req.user.roles = ['moderator'];
    const middleware = requireDynamicRole({
      resolver: async () => Promise.resolve(['moderator']),
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should require ALL roles when matchAll is true', async () => {
    req.user.roles = ['editor'];
    const middleware = requireDynamicRole({
      resolver: () => ['editor', 'reviewer'],
      matchAll: true,
    });
    await middleware(req, res, next);

    // Missing 'reviewer'
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  test('should allow when user has ALL roles and matchAll is true', async () => {
    req.user.roles = ['editor', 'reviewer', 'other'];
    const middleware = requireDynamicRole({
      resolver: () => ['editor', 'reviewer'],
      matchAll: true,
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should require ANY role when matchAll is false (default)', async () => {
    req.user.roles = ['reviewer'];
    const middleware = requireDynamicRole({
      resolver: () => ['editor', 'reviewer'],
      matchAll: false,
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireOwnership', () => {
  let req, res, next, hookMock;

  beforeEach(() => {
    const channelMock = { invoke: jest.fn() };
    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn().mockReturnValue(false);

    req = {
      user: { id: 1 },
      params: {},
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return hookMock;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should fail if user is not authenticated', async () => {
    req.user = undefined;
    const middleware = requireOwnership();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('AuthenticationRequiredError');
  });

  test('should allow access for admin role (bypass)', async () => {
    req.user.is_admin = true;
    req.params.userId = '999';
    const middleware = requireOwnership();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should not bypass for admin when adminBypass is false', async () => {
    req.user.is_admin = true;
    req.params.userId = '999';
    const middleware = requireOwnership({ adminBypass: false });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].code).toBe('OWNERSHIP_REQUIRED');
  });

  test('should allow access when param matches user id (default param)', async () => {
    req.user.id = 42;
    req.params.userId = '42';
    const middleware = requireOwnership();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow access with custom param name', async () => {
    req.user.id = 42;
    req.params.authorId = '42';
    const middleware = requireOwnership({ param: 'authorId' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny access when param does not match user id', async () => {
    req.user.id = 42;
    req.params.userId = '99';
    const middleware = requireOwnership();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  test('should use hook-based resolution with resourceType', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock().invoke.mockImplementation(async (event, r) => {
      r.isOwner = true;
    });

    req.params.id = '10';
    const middleware = requireOwnership({ resourceType: 'post' });
    await middleware(req, res, next);

    expect(hookMock.has).toHaveBeenCalledWith('auth.ownership');
    expect(hookMock).toHaveBeenCalledWith('auth.ownership');
    expect(hookMock().invoke).toHaveBeenCalledWith('resolve', req, {
      resourceType: 'post',
    });
    expect(next).toHaveBeenCalledWith();
  });

  test('should deny via hook when isOwner is false', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock().invoke.mockImplementation(async (event, r) => {
      r.isOwner = false;
    });

    req.params.id = '10';
    const middleware = requireOwnership({ resourceType: 'post' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].code).toBe('OWNERSHIP_REQUIRED');
    expect(next.mock.calls[0][0].message).toContain('post');
  });
});

describe('requireFlexibleOwnership', () => {
  let req, res, next, hookMock;

  beforeEach(() => {
    const channelMock = { invoke: jest.fn() };
    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn().mockReturnValue(false);

    req = {
      user: { id: 1 },
      params: {},
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return hookMock;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should fail if user is not authenticated', async () => {
    req.user = null;
    const middleware = requireFlexibleOwnership({
      strategies: [{ param: 'userId' }],
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  test('should allow access for admin role (bypass)', async () => {
    req.user.is_admin = true;
    const middleware = requireFlexibleOwnership({
      strategies: [{ param: 'userId' }],
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow via first param-based strategy', async () => {
    req.params = { userId: '1' };
    const middleware = requireFlexibleOwnership({
      strategies: [{ param: 'userId' }, { param: 'authorId' }],
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow via second strategy when first fails', async () => {
    req.params = { authorId: '1' };
    const middleware = requireFlexibleOwnership({
      strategies: [{ param: 'userId' }, { param: 'authorId' }],
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow via hook-based strategy', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.isOwner = true;
      }),
    });

    const middleware = requireFlexibleOwnership({
      strategies: [{ resourceType: 'post' }],
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should reset isOwner between strategies', async () => {
    hookMock.has.mockReturnValue(true);
    let callCount = 0;
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        callCount++;
        // First strategy denies, second allows
        r.isOwner = callCount === 2;
      }),
    });

    const middleware = requireFlexibleOwnership({
      strategies: [{ resourceType: 'comment' }, { resourceType: 'post' }],
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny when all strategies fail', async () => {
    req.params = { userId: '999' };
    const middleware = requireFlexibleOwnership({
      strategies: [{ param: 'userId' }, { param: 'authorId' }],
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
    expect(next.mock.calls[0][0].code).toBe('OWNERSHIP_REQUIRED');
  });

  test('should deny with empty strategies', async () => {
    const middleware = requireFlexibleOwnership({ strategies: [] });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
  });
});

describe('requireSharedOwnership', () => {
  let req, res, next, hookMock;

  beforeEach(() => {
    const channelMock = { invoke: jest.fn() };
    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn().mockReturnValue(false);

    req = {
      user: { id: 1 },
      params: { id: 'doc-1' },
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return hookMock;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should fail if user is not authenticated', async () => {
    req.user = null;
    const middleware = requireSharedOwnership({ resourceType: 'document' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  test('should allow access for admin role (bypass)', async () => {
    req.user.is_admin = true;
    const middleware = requireSharedOwnership({ resourceType: 'document' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow when user is among shared owners', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.sharedOwners = [1, 2, 3];
      }),
    });

    const middleware = requireSharedOwnership({ resourceType: 'document' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny when user is not among shared owners', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.sharedOwners = [2, 3, 4];
      }),
    });

    const middleware = requireSharedOwnership({ resourceType: 'document' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
    expect(next.mock.calls[0][0].code).toBe('SHARED_OWNERSHIP_REQUIRED');
  });

  test('should deny when sharedOwners is empty', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.sharedOwners = [];
      }),
    });

    const middleware = requireSharedOwnership({ resourceType: 'document' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  test('should deny when no hook is registered', async () => {
    hookMock.has.mockReturnValue(false);

    const middleware = requireSharedOwnership({ resourceType: 'document' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  test('should handle string ID comparison', async () => {
    req.user.id = '123';
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.sharedOwners = [123, 456];
      }),
    });

    const middleware = requireSharedOwnership({ resourceType: 'document' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireHierarchicalOwnership', () => {
  let req, res, next, hookMock;

  beforeEach(() => {
    const channelMock = { invoke: jest.fn() };
    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn().mockReturnValue(false);

    req = {
      user: { id: 'user-1' },
      params: { id: 'report-1' },
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return hookMock;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should fail if user is not authenticated', async () => {
    req.user = null;
    const middleware = requireHierarchicalOwnership({ resourceType: 'report' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  test('should allow access for admin role (bypass)', async () => {
    req.user.is_admin = true;
    const middleware = requireHierarchicalOwnership({ resourceType: 'report' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow when user is the direct owner in chain', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.ownerChain = ['user-1', 'manager-1', 'director-1'];
      }),
    });

    const middleware = requireHierarchicalOwnership({ resourceType: 'report' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow when user is an ancestor in the chain', async () => {
    req.user.id = 'director-1';
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.ownerChain = ['author-1', 'manager-1', 'director-1'];
      }),
    });

    const middleware = requireHierarchicalOwnership({ resourceType: 'report' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny when user is not in the chain', async () => {
    req.user.id = 'other-user';
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.ownerChain = ['author-1', 'manager-1', 'director-1'];
      }),
    });

    const middleware = requireHierarchicalOwnership({ resourceType: 'report' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
    expect(next.mock.calls[0][0].code).toBe('HIERARCHICAL_OWNERSHIP_REQUIRED');
  });

  test('should deny when ownerChain is empty', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.ownerChain = [];
      }),
    });

    const middleware = requireHierarchicalOwnership({ resourceType: 'report' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  test('should deny when no hook is registered', async () => {
    hookMock.has.mockReturnValue(false);

    const middleware = requireHierarchicalOwnership({ resourceType: 'report' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  test('should handle numeric ID comparison', async () => {
    req.user.id = 42;
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.ownerChain = ['42', '100', '200'];
      }),
    });

    const middleware = requireHierarchicalOwnership({ resourceType: 'report' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireTimeBasedOwnership', () => {
  let req, res, next, hookMock;

  beforeEach(() => {
    const channelMock = { invoke: jest.fn() };
    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn().mockReturnValue(false);

    req = {
      user: { id: 'user-1' },
      params: { id: 'post-1' },
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return hookMock;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should fail if user is not authenticated', async () => {
    req.user = null;
    const middleware = requireTimeBasedOwnership({ resourceType: 'post' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  test('should allow access for admin role (bypass)', async () => {
    req.user.is_admin = true;
    const middleware = requireTimeBasedOwnership({ resourceType: 'post' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow when user is owner and within time window', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.isOwner = true;
        r.ownershipExpiresAt = Date.now() + 60000; // 1 min from now
      }),
    });

    const middleware = requireTimeBasedOwnership({ resourceType: 'post' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny when user is owner but window has expired', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.isOwner = true;
        r.ownershipExpiresAt = Date.now() - 1000; // 1 sec ago
      }),
    });

    const middleware = requireTimeBasedOwnership({ resourceType: 'post' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
    expect(next.mock.calls[0][0].code).toBe('OWNERSHIP_EXPIRED');
  });

  test('should deny when user is not the owner', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.isOwner = false;
        r.ownershipExpiresAt = Date.now() + 60000;
      }),
    });

    const middleware = requireTimeBasedOwnership({ resourceType: 'post' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
    expect(next.mock.calls[0][0].code).toBe('OWNERSHIP_REQUIRED');
  });

  test('should allow owner when no expiresAt is set (no time constraint)', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.isOwner = true;
        // no ownershipExpiresAt set
      }),
    });

    const middleware = requireTimeBasedOwnership({ resourceType: 'post' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should handle Date object for ownershipExpiresAt', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock.mockReturnValue({
      invoke: jest.fn().mockImplementation(async (event, r) => {
        r.isOwner = true;
        r.ownershipExpiresAt = new Date(Date.now() - 5000); // expired Date
      }),
    });

    const middleware = requireTimeBasedOwnership({ resourceType: 'post' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].code).toBe('OWNERSHIP_EXPIRED');
  });

  test('should deny when no hook is registered (isOwner not set)', async () => {
    hookMock.has.mockReturnValue(false);

    const middleware = requireTimeBasedOwnership({ resourceType: 'post' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
    expect(next.mock.calls[0][0].code).toBe('OWNERSHIP_REQUIRED');
  });
});

describe('requireGroup', () => {
  let req, res, next, hookMock;

  beforeEach(() => {
    const channelMock = { invoke: jest.fn() };
    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn().mockReturnValue(false);

    req = {
      user: {},
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return hookMock;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should fail if user is not authenticated', async () => {
    req.user = undefined;
    const middleware = requireGroup('engineering');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('AuthenticationRequiredError');
  });

  test('should allow access for admin role (bypass)', async () => {
    req.user.is_admin = true;
    const middleware = requireGroup('engineering');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow access if user belongs to the required group', async () => {
    req.user.groups = ['engineering'];
    const middleware = requireGroup('engineering');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny access if user does not belong to the group', async () => {
    req.user.groups = ['marketing'];
    const middleware = requireGroup('engineering');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
    expect(next.mock.calls[0][0].code).toBe('GROUP_REQUIRED');
  });

  test('should require ALL groups when multiple are specified', async () => {
    req.user.groups = ['engineering'];
    const middleware = requireGroup('engineering', 'design');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toContain('design');
  });

  test('should allow when user belongs to ALL required groups', async () => {
    req.user.groups = ['engineering', 'design'];
    const middleware = requireGroup('engineering', 'design');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should invoke hook to resolve groups when registered', async () => {
    hookMock.has.mockReturnValue(true);
    hookMock().invoke.mockImplementation(async (event, r) => {
      r.user.groups = ['engineering'];
    });

    delete req.user.groups;
    const middleware = requireGroup('engineering');
    await middleware(req, res, next);

    expect(hookMock.has).toHaveBeenCalledWith('auth.groups');
    expect(hookMock).toHaveBeenCalledWith('auth.groups');
    expect(hookMock().invoke).toHaveBeenCalledWith('resolve', req);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireAnyGroup', () => {
  let req, res, next, hookMock;

  beforeEach(() => {
    const channelMock = { invoke: jest.fn() };
    hookMock = jest.fn().mockReturnValue(channelMock);
    hookMock.has = jest.fn().mockReturnValue(false);

    req = {
      user: {},
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return hookMock;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should allow access if user belongs to ANY of the groups', async () => {
    req.user.groups = ['marketing'];
    const middleware = requireAnyGroup('engineering', 'marketing');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny access if user belongs to NONE of the groups', async () => {
    req.user.groups = ['sales'];
    const middleware = requireAnyGroup('engineering', 'marketing');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
  });
});

describe('requireGroupLevel', () => {
  const HIERARCHY = ['junior', 'senior', 'lead', 'manager'];
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: 'user-1', groups: [] },
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'hook') return null;
                return null;
              },
            };
          return null;
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should fail if user is not authenticated', async () => {
    req.user = null;
    const middleware = requireGroupLevel('senior', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  test('should allow access for admin role (bypass)', async () => {
    req.user.is_admin = true;
    const middleware = requireGroupLevel('manager', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow when user group meets minimum level', async () => {
    req.user.groups = ['lead'];
    const middleware = requireGroupLevel('lead', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should allow when user group exceeds minimum level', async () => {
    req.user.groups = ['manager'];
    const middleware = requireGroupLevel('senior', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should deny when user group is below minimum level', async () => {
    req.user.groups = ['junior'];
    const middleware = requireGroupLevel('lead', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].name).toBe('ForbiddenError');
    expect(next.mock.calls[0][0].status).toBe(403);
    expect(next.mock.calls[0][0].code).toBe('GROUP_LEVEL_REQUIRED');
  });

  test('should deny when user has no groups', async () => {
    delete req.user.groups;
    const middleware = requireGroupLevel('junior', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  test('should return 500 for invalid minimum group configuration', async () => {
    req.user.groups = ['lead'];
    const middleware = requireGroupLevel('nonexistent', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(500);
    expect(next.mock.calls[0][0].code).toBe('INVALID_GROUP_CONFIG');
  });

  test('should ignore user groups not in hierarchy', async () => {
    req.user.groups = ['unknown-group'];
    const middleware = requireGroupLevel('junior', HIERARCHY);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
  });
});
