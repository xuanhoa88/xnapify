/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import ApiRouter from './index';

const mockModuleLoader = {
  files: () => [
    './(default)/api/routes/(default)/_route.js',
    './users/api/routes/auth/_route.js',
    './plugins/api/routes/plugins/[id]/_route.js',
    './plugins/api/routes/_middleware.js',
  ],
  load: path => {
    if (path.includes('auth')) {
      return {
        post: (req, res) => res.json({ action: 'login' }),
        get: (req, res) => res.json({ action: 'me' }),
      };
    }
    if (path.includes('plugins/[id]')) {
      return {
        get: (req, res) => res.json({ plugin: req.params.id }),
      };
    }
    if (path.includes('_middleware')) {
      return (req, res, next) => {
        req.hasPluginMiddleware = true;
        next();
      };
    }
    return {
      default: (req, res) => res.json({ hello: 'api' }),
    };
  },
};

describe('ApiRouter Engine', () => {
  it('should build routes correctly including dynamic params and middlewares', () => {
    const router = new ApiRouter(mockModuleLoader);

    // Root should exist
    const rootRoute = router.routes.find(r => r.path === '/');
    expect(rootRoute).toBeDefined();

    // /auth/users should exist
    const authRoute = rootRoute.children.find(r => r.path === '/auth/users');
    expect(authRoute).toBeDefined();

    // /plugins/:id should exist
    const pluginRoute = rootRoute.children.find(r => r.path === '/plugins/:id');
    expect(pluginRoute).toBeDefined();
  });

  it('should handle routing to an exact method explicitly', async () => {
    const router = new ApiRouter(mockModuleLoader);
    const { expressMiddleware } = router;

    // Mock Express request/response
    const req = {
      method: 'POST',
      path: '/auth/users',
      params: {},
    };

    const res = {
      json: jest.fn(),
    };

    const next = jest.fn();

    await expressMiddleware(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ action: 'login' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should extract dynamic route parameters correctly', async () => {
    const router = new ApiRouter(mockModuleLoader);
    const { expressMiddleware } = router;

    const req = {
      method: 'GET',
      path: '/plugins/my-plugin-id',
      params: {},
    };

    const res = {
      json: jest.fn(),
    };

    const next = jest.fn();

    await expressMiddleware(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ plugin: 'my-plugin-id' });
    expect(req.params.id).toBe('my-plugin-id');
  });

  it('should execute collocated middlewares', async () => {
    const router = new ApiRouter(mockModuleLoader);
    const { expressMiddleware } = router;

    const req = {
      method: 'GET',
      path: '/plugins/my-plugin-id',
      params: {},
    };

    const res = {
      json: jest.fn(),
    };

    const next = jest.fn();

    await expressMiddleware(req, res, next);

    expect(req.hasPluginMiddleware).toBe(true);
    expect(res.json).toHaveBeenCalledWith({ plugin: 'my-plugin-id' });
  });

  it('should fallback to 404 (next) if method not found on route', async () => {
    const router = new ApiRouter(mockModuleLoader);

    const req = {
      method: 'DELETE', // not implemented
      path: '/auth/users',
      params: {},
    };

    const res = {
      json: jest.fn(),
    };

    const next = jest.fn();

    await router.expressMiddleware(req, res, next);

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled(); // Should proceed to normal 404 handler
  });
});
