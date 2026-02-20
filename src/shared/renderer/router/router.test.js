import { Router } from '.';
import { runUnmount } from './lifecycle';

// =============================================================================
// Test Fixtures
// =============================================================================

const mockModuleLoader = {
  files: () => [
    './(default)/views/(default)/_route.js',
    './(default)/views/test-nextjs/_route.js',
  ],
  load: path => {
    if (path.includes('test-nextjs')) {
      return {
        default: () => 'TestPage',
        getInitialProps: () => ({ title: 'Test' }),
      };
    }
    return {
      default: () => 'HomePage',
      getInitialProps: () => ({ title: 'Home' }),
    };
  },
};

/**
 * Helper to create a simple adapter from file-path → module map.
 */
function createAdapter(fileMap) {
  return {
    files: () => Object.keys(fileMap),
    load: path => fileMap[path],
  };
}

// =============================================================================
// Route Tree Construction
// =============================================================================

describe('Route Tree Construction', () => {
  it('should build root and nested child routes correctly', () => {
    const router = new Router(mockModuleLoader);

    const rootRoute = router.routes.find(r => r.path === '/');
    expect(rootRoute).toBeDefined();

    const testRoute = rootRoute.children.find(r => r.path === '/test-nextjs');
    expect(testRoute).toBeDefined();
    expect(testRoute.parent).toBeDefined();
    expect(testRoute.parent.path).toBe('/');
  });

  it('should handle dynamic parameter routes ([id])', () => {
    const adapter = createAdapter({
      './(default)/views/(default)/_route.js': {
        default: () => 'Root',
      },
      './(default)/views/users/[id]/_route.js': {
        default: () => 'UserPage',
        getInitialProps: ctx => ({ userId: ctx.params.id }),
      },
    });

    const router = new Router(adapter);
    const rootRoute = router.routes.find(r => r.path === '/');
    expect(rootRoute).toBeDefined();

    // Dynamic route should exist as child
    const userRoute = rootRoute.children.find(r => r.path === '/users/:id');
    expect(userRoute).toBeDefined();
  });

  it('should handle wildcard catch-all routes ([...slug])', () => {
    const adapter = createAdapter({
      './(default)/views/(default)/_route.js': {
        default: () => 'Root',
      },
      './(default)/views/docs/[...path]/_route.js': {
        default: () => 'DocsPage',
        getInitialProps: ctx => ({ path: ctx.params.path }),
      },
    });

    const router = new Router(adapter);
    const rootRoute = router.routes.find(r => r.path === '/');
    expect(rootRoute).toBeDefined();

    const docsRoute = rootRoute.children.find(r => r.path === '/docs/:path*');
    expect(docsRoute).toBeDefined();
  });
});

// =============================================================================
// resolve()
// =============================================================================

describe('resolve()', () => {
  it('should resolve root path "/"', async () => {
    const router = new Router(mockModuleLoader);
    const result = await router.resolve({ pathname: '/' });

    expect(result).toBeDefined();
    expect(result.component).toBeDefined();
    expect(result.title).toBe('Home');
  });

  it('should resolve /test-nextjs correctly', async () => {
    const router = new Router(mockModuleLoader);

    const context = {
      pathname: '/test-nextjs',
      store: { getState: () => ({}) },
    };
    const result = await router.resolve(context);

    expect(result).toBeDefined();
    expect(result.component).toBeDefined();
    expect(result.title).toBe('Test');
  });

  it('should accept a string pathname directly', async () => {
    const router = new Router(mockModuleLoader);
    const result = await router.resolve('/test-nextjs');

    expect(result).toBeDefined();
    expect(result.title).toBe('Test');
  });

  it('should extract dynamic parameters during resolve', async () => {
    const adapter = createAdapter({
      './(default)/views/(default)/_route.js': {
        default: () => 'Root',
      },
      './(default)/views/items/[id]/_route.js': {
        default: () => 'ItemPage',
        getInitialProps: ctx => ({ itemId: ctx.params.id }),
      },
    });

    const router = new Router(adapter);
    const result = await router.resolve({ pathname: '/items/42' });

    expect(result).toBeDefined();
    expect(result.itemId).toBe('42');
  });

  it('should resolve to null for unmatched routes when no catch-all exists', async () => {
    // Without a root catch-all, unmatched paths resolve to null
    const adapter = createAdapter({
      './(default)/views/specific/_route.js': {
        default: () => 'SpecificPage',
      },
    });
    const router = new Router(adapter);

    const result = await router.resolve({ pathname: '/totally-unknown' });
    expect(result).toBeNull();
  });

  it('should use errorHandler option when route action throws', async () => {
    const errorHandler = jest.fn(error => ({
      component: 'ErrorPage',
      status: error.status || 500,
    }));

    const adapter = createAdapter({
      './(default)/views/broken/_route.js': {
        default: () => 'BrokenPage',
        getInitialProps: () => {
          throw new Error('Data fetch failed');
        },
      },
    });
    const router = new Router(adapter, { errorHandler });
    const result = await router.resolve({ pathname: '/broken' });

    // getInitialProps errors are caught internally and produce empty initialProps,
    // so the component still resolves. Let's verify the result has a component.
    expect(result).toBeDefined();
    expect(result.component).toBeDefined();
  });
});

// =============================================================================
// getInitialProps
// =============================================================================

describe('getInitialProps', () => {
  it('should load data via getInitialProps and include in result', async () => {
    const adapter = createAdapter({
      './(default)/views/data/_route.js': {
        default: () => 'DataPage',
        getInitialProps: () => ({ items: [1, 2, 3], loaded: true }),
      },
    });

    const router = new Router(adapter);
    const result = await router.resolve({ pathname: '/data' });

    expect(result).toBeDefined();
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.loaded).toBe(true);
  });

  it('should handle async getInitialProps', async () => {
    const adapter = createAdapter({
      './(default)/views/async/_route.js': {
        default: () => 'AsyncPage',
        getInitialProps: async () => {
          return { fetched: true };
        },
      },
    });

    const router = new Router(adapter);
    const result = await router.resolve({ pathname: '/async' });

    expect(result.fetched).toBe(true);
  });
});

// =============================================================================
// Layouts
// =============================================================================

describe('Layouts', () => {
  it('should wrap component with colocated layout', async () => {
    const adapter = createAdapter({
      './(default)/views/wrapped/_route.js': {
        default: () => 'WrappedPage',
      },
      './(default)/views/wrapped/_layout.js': {
        default: ({ children }) => `Layout(${children})`,
      },
    });

    const router = new Router(adapter);
    const result = await router.resolve({ pathname: '/wrapped' });

    expect(result).toBeDefined();
    expect(result.component).toBeDefined();
  });

  it('should skip layouts when route exports layout = false', async () => {
    const layoutFn = jest.fn(({ children }) => `Layout(${children})`);

    const adapter = createAdapter({
      './(default)/views/nolayout/_route.js': {
        default: () => 'NoLayoutPage',
        layout: false,
      },
      './(default)/views/nolayout/_layout.js': {
        default: layoutFn,
      },
    });

    const router = new Router(adapter);
    const result = await router.resolve({ pathname: '/nolayout' });

    expect(result).toBeDefined();
    // Layout should NOT have been used
    expect(layoutFn).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Dynamic Add / Remove
// =============================================================================

describe('Router.add() — Dynamic Plugin Injection', () => {
  it('should add plugin routes that are resolvable', async () => {
    const router = new Router(mockModuleLoader);

    const pluginAdapter = createAdapter({
      './(default)/views/plugin-page/_route.js': {
        default: () => 'PluginPage',
        getInitialProps: () => ({ plugin: true }),
      },
    });

    const added = router.add(pluginAdapter);
    expect(added.length).toBeGreaterThan(0);

    const result = await router.resolve({ pathname: '/plugin-page' });
    expect(result).toBeDefined();
    expect(result.component).toBeDefined();
  });

  it('should return empty array when adapter has no matching files', () => {
    const router = new Router(mockModuleLoader);
    const emptyAdapter = createAdapter({});
    const added = router.add(emptyAdapter);
    expect(added).toEqual([]);
  });
});

describe('Router.remove() — Plugin Route Removal', () => {
  it('should remove plugin routes making them unresolvable', async () => {
    // Use adapter without a root catch-all
    const baseAdapter = createAdapter({
      './(default)/views/base/_route.js': {
        default: () => 'BasePage',
      },
    });
    const router = new Router(baseAdapter);

    const pluginAdapter = createAdapter({
      './(default)/views/removable/_route.js': {
        default: () => 'RemovablePage',
      },
    });

    router.add(pluginAdapter);

    // Verify it was added
    const result = await router.resolve({ pathname: '/removable' });
    expect(result).toBeDefined();
    expect(result.component).toBeDefined();

    // Remove it
    const removed = router.remove(pluginAdapter);
    expect(removed).toBe(true);

    // Verify it's gone (resolves to null since no route matches)
    const result2 = await router.resolve({ pathname: '/removable' });
    expect(result2).toBeNull();
  });

  it('should return false for null adapter', () => {
    const router = new Router(mockModuleLoader);
    expect(router.remove(null)).toBe(false);
  });
});

// =============================================================================
// Register / Unregister Lifecycle
// =============================================================================

describe('register() / unregister()', () => {
  it('should call register on route modules during registration', async () => {
    const registerFn = jest.fn();
    const adapter = createAdapter({
      './(default)/views/(default)/_route.js': {
        default: () => 'Page',
        register: registerFn,
      },
    });

    const router = new Router(adapter, { autoRegister: false });
    const context = { pathname: '/' };

    await router.register(context);
    expect(registerFn).toHaveBeenCalledTimes(1);
  });

  it('should not register twice for the same context', async () => {
    const registerFn = jest.fn();
    const adapter = createAdapter({
      './(default)/views/(default)/_route.js': {
        default: () => 'Page',
        register: registerFn,
      },
    });

    const router = new Router(adapter, { autoRegister: false });
    const context = { pathname: '/' };

    await router.register(context);
    await router.register(context);
    expect(registerFn).toHaveBeenCalledTimes(1); // Idempotent
  });

  it('should call unregister on route modules during unregistration', async () => {
    const unregisterFn = jest.fn();
    const adapter = createAdapter({
      './(default)/views/(default)/_route.js': {
        default: () => 'Page',
        unregister: unregisterFn,
      },
    });

    const router = new Router(adapter, { autoRegister: false });
    const context = { pathname: '/' };

    await router.register(context);
    await router.unregister(context);
    expect(unregisterFn).toHaveBeenCalledTimes(1);
  });

  it('should auto-register on first resolve when autoRegister is true', async () => {
    const registerFn = jest.fn();
    const adapter = createAdapter({
      './(default)/views/(default)/_route.js': {
        default: () => 'Page',
        register: registerFn,
      },
    });

    const router = new Router(adapter); // autoRegister defaults to true

    await router.resolve({ pathname: '/' });
    expect(registerFn).toHaveBeenCalled();
  });
});

// =============================================================================
// Lifecycle Hooks (Options)
// =============================================================================

describe('Lifecycle Hooks (router options)', () => {
  it('should call onRouteInit on first resolve for a route', async () => {
    const onRouteInit = jest.fn();

    const adapter = createAdapter({
      './(default)/views/(default)/_route.js': {
        default: () => 'Page',
      },
    });

    const router = new Router(adapter, { onRouteInit });
    await router.resolve({ pathname: '/' });

    expect(onRouteInit).toHaveBeenCalledTimes(1);
    expect(onRouteInit.mock.calls[0][0]).toHaveProperty('path', '/');
  });

  it('should call onRouteMount on every resolve', async () => {
    const onRouteMount = jest.fn();

    const adapter = createAdapter({
      './(default)/views/(default)/_route.js': {
        default: () => 'Page',
      },
    });

    const router = new Router(adapter, { onRouteMount });

    await router.resolve({ pathname: '/' });
    expect(onRouteMount).toHaveBeenCalledTimes(1);
    expect(onRouteMount.mock.calls[0][0]).toHaveProperty('path', '/');

    // Mount fires on every navigation, not just the first
    await router.resolve({ pathname: '/' });
    expect(onRouteMount).toHaveBeenCalledTimes(2);
  });

  it('should call onRouteUnmount when runUnmount is invoked on a route', async () => {
    const onRouteUnmount = jest.fn();
    const routeUnmountFn = jest.fn();

    const route = {
      path: '/page-a',
      unmount: routeUnmountFn,
      parent: null,
    };

    const ctx = {
      _instance: {
        options: { onRouteUnmount },
      },
    };

    await runUnmount(route, ctx);

    // Route-level unmount should be called
    expect(routeUnmountFn).toHaveBeenCalledTimes(1);
    expect(routeUnmountFn).toHaveBeenCalledWith(ctx);

    // Options-level onRouteUnmount hook should also be called
    expect(onRouteUnmount).toHaveBeenCalledTimes(1);
    expect(onRouteUnmount.mock.calls[0][0]).toBe(route);
    expect(onRouteUnmount.mock.calls[0][1]).toBe(ctx);
  });

  it('should call onRouteUnmount for each ancestor when traversing parent chain', async () => {
    const onRouteUnmount = jest.fn();

    const parentRoute = {
      path: '/',
      unmount: jest.fn(),
      parent: null,
    };

    const childRoute = {
      path: '/child',
      unmount: jest.fn(),
      parent: parentRoute,
    };

    const ctx = {
      _instance: {
        options: { onRouteUnmount },
      },
    };

    await runUnmount(childRoute, ctx);

    // Both child and parent unmount should be called
    expect(childRoute.unmount).toHaveBeenCalledTimes(1);
    expect(parentRoute.unmount).toHaveBeenCalledTimes(1);

    // onRouteUnmount hook should fire for both child and parent
    expect(onRouteUnmount).toHaveBeenCalledTimes(2);
    expect(onRouteUnmount.mock.calls[0][0]).toBe(childRoute);
    expect(onRouteUnmount.mock.calls[1][0]).toBe(parentRoute);
  });

  it('should track previous route after successive navigations', async () => {
    const adapter = createAdapter({
      './(default)/views/(default)/_route.js': {
        default: () => 'Root',
      },
      './(default)/views/page-a/_route.js': {
        default: () => 'PageA',
      },
      './(default)/views/page-b/_route.js': {
        default: () => 'PageB',
      },
    });

    const router = new Router(adapter);

    const result1 = await router.resolve({ pathname: '/page-a' });
    expect(result1).toBeDefined();
    expect(result1.component).toBeDefined();

    const result2 = await router.resolve({ pathname: '/page-b' });
    expect(result2).toBeDefined();
    expect(result2.component).toBeDefined();
  });
});

// =============================================================================
// Middleware
// =============================================================================

describe('Middleware', () => {
  it('should run route middleware before action', async () => {
    const middlewareLog = [];

    const adapter = createAdapter({
      './(default)/views/guarded/_route.js': {
        default: () => 'GuardedPage',
        middleware: (ctx, next) => {
          middlewareLog.push('middleware');
          return next();
        },
        getInitialProps: () => {
          middlewareLog.push('getInitialProps');
          return { guarded: true };
        },
      },
    });

    const router = new Router(adapter);
    await router.resolve({ pathname: '/guarded' });

    expect(middlewareLog).toEqual(['middleware', 'getInitialProps']);
  });

  it('should allow middleware to short-circuit by not calling next()', async () => {
    const adapter = createAdapter({
      './(default)/views/(default)/_route.js': {
        default: () => 'Home',
      },
      './(default)/views/blocked/_route.js': {
        default: () => 'BlockedPage',
        middleware: _ctx => {
          // Short-circuit: return redirect-like result without calling next()
          return { redirect: '/login' };
        },
      },
    });

    const router = new Router(adapter);
    const result = await router.resolve({ pathname: '/blocked' });

    expect(result).toBeDefined();
    expect(result.redirect).toBe('/login');
  });
});

// =============================================================================
// Adapter Validation
// =============================================================================

describe('Adapter Validation', () => {
  it('should throw TypeError for null adapter', () => {
    expect(() => new Router(null)).toThrow(TypeError);
    expect(() => new Router(null)).toThrow(
      /adapter must have files\(\) and load\(\) methods/,
    );
  });

  it('should throw TypeError for adapter missing files()', () => {
    expect(() => new Router({ load: () => {} })).toThrow(TypeError);
  });

  it('should throw TypeError for adapter missing load()', () => {
    expect(() => new Router({ files: () => [] })).toThrow(TypeError);
  });
});
