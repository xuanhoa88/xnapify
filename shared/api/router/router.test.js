/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Router from '.';
import {
  RouterError,
  normalizeError,
  normalizePath,
  decodeUrl,
  getRootSegment,
  createError,
  isDescendant,
} from './utils';

const mockModuleLoader = {
  files: () => [
    './(default)/api/routes/(default)/_route.js',
    './auth/api/routes/(default)/_route.js',
    './plugins/api/routes/[id]/_route.js',
    './plugins/api/routes/_middleware.js',
    './users/api/routes/(admin)/_route.js',
    './users/api/routes/(admin)/(default)/_route.js',
    './users/api/routes/(admin)/_middleware.js',
    './users/api/routes/(admin)/(default)/_middleware.js',
  ],
  load: path => {
    if (path.includes('/auth/')) {
      return {
        post: (req, res) => res.json({ action: 'login' }),
        get: (req, res) => res.json({ action: 'me' }),
      };
    }
    if (path.includes('[id]')) {
      return {
        // Handlers must explicitly call res.json() — no auto-formatting
        get: (req, res) => {
          res.json({
            plugin: req.params.id,
            hasMiddleware: req.hasPluginMiddleware || false,
          });
        },
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

describe('Router Engine', () => {
  it('should build routes correctly including dynamic params and middlewares', () => {
    const router = new Router(mockModuleLoader);

    // Root should exist
    const rootRoute = router.routes.find(r => r.path === '/');
    expect(rootRoute).toBeDefined();

    // /auth should exist
    const authRoute = rootRoute.children.find(r => r.path === '/auth');
    expect(authRoute).toBeDefined();

    // /plugins/:id should exist
    const pluginRoute = rootRoute.children.find(r => r.path === '/plugins/:id');
    expect(pluginRoute).toBeDefined();

    // /admin/users should exist from (admin) route group injection
    const adminRoute = rootRoute.children.find(r => r.path === '/admin/users');
    expect(adminRoute).toBeDefined();
  });

  it('should handle routing to an exact method explicitly', async () => {
    const router = new Router(mockModuleLoader);
    const { resolve } = router;

    const req = {
      method: 'POST',
      path: '/auth',
      params: {},
    };

    const res = {
      json: jest.fn(),
    };

    const next = jest.fn();

    await resolve(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ action: 'login' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should extract dynamic route parameters correctly', async () => {
    const router = new Router(mockModuleLoader);
    const { resolve } = router;

    const req = {
      method: 'GET',
      path: '/plugins/my-plugin-id',
      params: {},
    };

    const res = {
      json: jest.fn(),
    };
    const next = jest.fn();

    await resolve(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      plugin: 'my-plugin-id',
      hasMiddleware: true,
    });
    expect(req.params.id).toBe('my-plugin-id');
  });

  it('should execute collocated middlewares sequentially', async () => {
    const router = new Router(mockModuleLoader);
    const { resolve } = router;

    const req = {
      method: 'GET',
      path: '/plugins/my-plugin-id',
      params: {},
    };

    const res = {
      json: jest.fn(),
    };
    const next = jest.fn();

    await resolve(req, res, next);

    expect(req.hasPluginMiddleware).toBe(true);
    expect(res.json).toHaveBeenCalledWith({
      plugin: 'my-plugin-id',
      hasMiddleware: true,
    });
  });

  it('should fallback to 404 handler if method not found on route', async () => {
    const router = new Router(mockModuleLoader);

    const req = {
      method: 'DELETE', // not implemented
      path: '/auth',
      params: {},
    };

    const res = {
      json: jest.fn(),
    };

    const next = jest.fn();

    await router.resolve(req, res, next);

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

describe('Error Normalization', () => {
  it('should normalize a standard Error into RouterError', () => {
    const err = new Error('something broke');
    err.status = 422;
    const normalized = normalizeError(err);

    expect(normalized).toBeInstanceOf(RouterError);
    expect(normalized.message).toBe('something broke');
    expect(normalized.status).toBe(422);
    expect(normalized.code).toBe('INTERNAL_ERROR');
  });

  it('should return RouterError instance as-is', () => {
    const err = new RouterError('already normalized', 400, {
      code: 'BAD_REQUEST',
    });
    expect(normalizeError(err)).toBe(err);
  });

  it('should normalize a string throw', () => {
    const normalized = normalizeError('string error');
    expect(normalized).toBeInstanceOf(RouterError);
    expect(normalized.message).toBe('string error');
    expect(normalized.status).toBe(500);
  });

  it('should normalize null/undefined', () => {
    const normalized = normalizeError(null);
    expect(normalized).toBeInstanceOf(RouterError);
    expect(normalized.status).toBe(500);
    expect(normalized.message).toBe('Internal Server Error');
  });
});

describe('Router.add() — Dynamic Plugin Injection', () => {
  it('should add plugin routes that are reachable', async () => {
    const router = new Router(mockModuleLoader);

    const pluginAdapter = {
      files: () => ['./(default)/api/routes/stats/_route.js'],
      load: () => ({
        get: (req, res) => res.json({ stats: true }),
      }),
    };

    const added = router.add(pluginAdapter);
    expect(added.length).toBeGreaterThan(0);

    const req = { method: 'GET', path: '/stats', params: {} };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await router.resolve(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ stats: true });
  });

  it('should merge children into existing parent routes', async () => {
    const router = new Router(mockModuleLoader);

    const pluginAdapter = {
      files: () => ['./(default)/api/routes/extra/_route.js'],
      load: () => ({
        get: (req, res) => res.json({ extra: true }),
      }),
    };

    router.add(pluginAdapter);
    // Root route should still exist; the new route merges as a child
    const rootRoute = router.routes.find(r => r.path === '/');
    expect(rootRoute).toBeDefined();

    const req = { method: 'GET', path: '/extra', params: {} };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await router.resolve(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ extra: true });
  });

  it('should return empty array when adapter has no matching files', () => {
    const router = new Router(mockModuleLoader);

    const emptyAdapter = {
      files: () => [],
      load: () => ({}),
    };

    const added = router.add(emptyAdapter);
    expect(added).toEqual([]);
  });
});

describe('Router.remove() — Plugin Route Removal', () => {
  it('should remove routes from a specific adapter', async () => {
    const router = new Router(mockModuleLoader);

    const pluginAdapter = {
      files: () => ['./(default)/api/routes/removable/_route.js'],
      load: () => ({
        get: (req, res) => res.json({ removable: true }),
      }),
    };

    router.add(pluginAdapter);

    // Verify it was added
    let req = { method: 'GET', path: '/removable', params: {} };
    let res = { json: jest.fn() };
    let next = jest.fn();
    await router.resolve(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ removable: true });

    // Remove it
    const removed = router.remove(pluginAdapter);
    expect(removed).toBe(true);

    // Verify it's gone
    req = { method: 'GET', path: '/removable', params: {} };
    res = { json: jest.fn() };
    next = jest.fn();
    await router.resolve(req, res, next);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('should return false when adapter has no matching routes', () => {
    const router = new Router(mockModuleLoader);

    const unknownAdapter = {
      files: () => [],
      load: () => ({}),
    };

    expect(router.remove(unknownAdapter)).toBe(false);
  });

  it('should return false for null adapter', () => {
    const router = new Router(mockModuleLoader);
    expect(router.remove(null)).toBe(false);
  });
});

describe('Middleware opt-out (middleware = false)', () => {
  it('should skip parent middlewares when route exports middleware = false', async () => {
    const adapter = {
      files: () => [
        './(default)/api/routes/(default)/_route.js',
        './(default)/api/routes/public/_route.js',
        './(default)/api/routes/_middleware.js',
      ],
      load: path => {
        if (path.includes('_middleware')) {
          return (req, res, next) => {
            req.middlewareRan = true;
            next();
          };
        }
        if (path.includes('public')) {
          return {
            middleware: false,
            get: (req, res) =>
              res.json({ public: true, middlewareRan: !!req.middlewareRan }),
          };
        }
        return {
          default: (req, res) =>
            res.json({ middlewareRan: !!req.middlewareRan }),
        };
      },
    };

    const router = new Router(adapter);

    // Public route should NOT run the middleware
    const req = { method: 'GET', path: '/public', params: {} };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await router.resolve(req, res, next);
    expect(res.json).toHaveBeenCalledWith({
      public: true,
      middlewareRan: false,
    });
  });
});

describe('Method-specific middleware arrays', () => {
  it('should run method-specific middlewares only for that method', async () => {
    const adapter = {
      files: () => ['./(default)/api/routes/items/_route.js'],
      load: () => ({
        middleware: false,
        get: (req, res) => res.json({ method: 'get', auth: !!req.authed }),
        post: [
          (req, res, next) => {
            req.authed = true;
            next();
          },
          (req, res) => res.json({ method: 'post', auth: !!req.authed }),
        ],
      }),
    };

    const router = new Router(adapter);

    // GET should NOT have auth middleware
    let req = { method: 'GET', path: '/items', params: {} };
    let res = { json: jest.fn() };
    let next = jest.fn();
    await router.resolve(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ method: 'get', auth: false });

    // POST should have auth middleware
    req = { method: 'POST', path: '/items', params: {} };
    res = { json: jest.fn() };
    next = jest.fn();
    await router.resolve(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ method: 'post', auth: true });
  });
});

describe('Wildcard catch-all routes', () => {
  it('should match wildcard catch-all segments [...slug]', async () => {
    const adapter = {
      files: () => ['./(default)/api/routes/files/[...path]/_route.js'],
      load: () => ({
        get: (req, res) => res.json({ filePath: req.params.path }),
      }),
    };

    const router = new Router(adapter);

    const req = {
      method: 'GET',
      path: '/files/docs/readme/intro',
      params: {},
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await router.resolve(req, res, next);
    expect(res.json).toHaveBeenCalledWith({
      filePath: 'docs/readme/intro',
    });
  });
});

describe('Lifecycle hooks', () => {
  it('should call onRouteInit and onRouteMount hooks', async () => {
    const onRouteInit = jest.fn();
    const onRouteMount = jest.fn();

    const adapter = {
      files: () => ['./(default)/api/routes/(default)/_route.js'],
      load: () => ({
        get: (req, res) => res.json({ ok: true }),
      }),
    };

    const router = new Router(adapter, { onRouteInit, onRouteMount });

    const req = { method: 'GET', path: '/', params: {}, app: {} };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await router.resolve(req, res, next);

    expect(onRouteInit).toHaveBeenCalledTimes(1);
    expect(onRouteInit.mock.calls[0][0]).toHaveProperty('path', '/');
    expect(onRouteMount).toHaveBeenCalledTimes(1);
    expect(onRouteMount.mock.calls[0][0]).toHaveProperty('path', '/');
  });
});

describe('Instance-level cache isolation', () => {
  it('should maintain separate caches for different Router instances', async () => {
    const adapter1 = {
      files: () => ['./(default)/api/routes/(default)/_route.js'],
      load: () => ({
        get: (req, res) => res.json({ router: 1 }),
      }),
    };

    const adapter2 = {
      files: () => ['./(default)/api/routes/other/_route.js'],
      load: () => ({
        get: (req, res) => res.json({ router: 2 }),
      }),
    };

    const router1 = new Router(adapter1);
    const router2 = new Router(adapter2);

    // Router1 should match /
    let req = { method: 'GET', path: '/', params: {} };
    let res = { json: jest.fn() };
    let next = jest.fn();
    await router1.resolve(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ router: 1 });

    // Router2 should match /other, not /
    req = { method: 'GET', path: '/other', params: {} };
    res = { json: jest.fn() };
    next = jest.fn();
    await router2.resolve(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ router: 2 });

    // Router2 should NOT match / (it should have its own cache)
    req = { method: 'GET', path: '/', params: {} };
    res = { json: jest.fn() };
    next = jest.fn();
    await router2.resolve(req, res, next);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

describe('Utils', () => {
  it('normalizePath should remove duplicate slashes and trailing slashes', () => {
    expect(normalizePath('//api///users//')).toBe('/api/users');
    expect(normalizePath('/api')).toBe('/api');
  });

  it('normalizePath should throw on path traversal', () => {
    expect(() => normalizePath('/api/../users')).toThrow(RouterError);
  });

  it('decodeUrl should decode safely', () => {
    expect(decodeUrl('hello%20world')).toBe('hello world');
    expect(decodeUrl('%E0%A4%A')).toBe('%E0%A4%A'); // Malformed URI, should return original
  });

  it('getRootSegment should return first segment', () => {
    expect(getRootSegment('/api/users/1')).toBe('api');
    expect(getRootSegment('/')).toBeNull();
  });

  it('createError should create a RouterError', () => {
    const err = createError('test error', 404, { code: 'TEST_CODE' });
    expect(err).toBeInstanceOf(RouterError);
    expect(err.message).toBe('test error');
    expect(err.status).toBe(404);
    expect(err.code).toBe('TEST_CODE');
  });

  it('isDescendant should correctly identify ancestry', () => {
    const parent = { path: '/parent' };
    const child = { path: '/child', parent };
    const grandchild = { path: '/grandchild', parent: child };
    const unrelated = { path: '/unrelated' };

    expect(isDescendant(parent, grandchild)).toBe(true);
    expect(isDescendant(parent, child)).toBe(true);
    expect(isDescendant(parent, unrelated)).toBe(false);
  });
});

describe('Action handler fallback and promises', () => {
  it('should pass to next(err) if handler returns a rejecting promise', async () => {
    const adapter = {
      files: () => ['./(default)/api/routes/async/_route.js'],
      load: () => ({
        get: async () => {
          throw new Error('Async failed');
        },
      }),
    };
    const router = new Router(adapter);
    const req = { method: 'GET', path: '/async', params: {} };
    const res = {};
    const next = jest.fn();

    await router.resolve(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].message).toBe('Async failed');
  });

  it('should call next() without error if no handler found for method', async () => {
    const adapter = {
      files: () => ['./(default)/api/routes/nomethod/_route.js'],
      load: () => ({
        post: (req, res) => res.json({ ok: true }),
      }),
    };
    const router = new Router(adapter);
    const req = { method: 'GET', path: '/nomethod', params: {} };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await router.resolve(req, res, next);

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(); // Called without args
  });

  it('should support module exporting a function directly', async () => {
    const adapter = {
      files: () => ['./(default)/api/routes/direct/_route.js'],
      load: () => (req, res) => res.json({ direct: true }),
    };
    const router = new Router(adapter);
    const req = { method: 'GET', path: '/direct', params: {} };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await router.resolve(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ direct: true });
  });
});

describe('Radix Tree Priority', () => {
  it('should prioritize static segments over dynamic parameters', async () => {
    const adapter = {
      files: () => [
        './(default)/api/routes/items/new/_route.js',
        './(default)/api/routes/items/[id]/_route.js',
      ],
      load: path => {
        if (path.includes('new')) {
          return { get: (req, res) => res.json({ type: 'static_new' }) };
        }
        return {
          get: (req, res) => res.json({ type: 'dynamic', id: req.params.id }),
        };
      },
    };
    const router = new Router(adapter);

    // Call /items/new
    let req = { method: 'GET', path: '/items/new', params: {} };
    let res = { json: jest.fn() };
    let next = jest.fn();
    await router.resolve(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ type: 'static_new' });

    // Call /items/42
    req = { method: 'GET', path: '/items/42', params: {} };
    res = { json: jest.fn() };
    next = jest.fn();
    await router.resolve(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ type: 'dynamic', id: '42' });
  });
});

describe('Router Validation', () => {
  it('should throw if adapter lacks files or load methods', () => {
    expect(() => new Router({})).toThrow(
      'adapter must have files() and load() methods',
    );
    expect(() => new Router({ files: () => [] })).toThrow(
      'adapter must have files() and load() methods',
    );
    expect(() => new Router({ load: () => ({}) })).toThrow(
      'adapter must have files() and load() methods',
    );
  });
});
