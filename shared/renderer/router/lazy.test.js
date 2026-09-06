/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { materializeTree } from './builder.js';

import { Router } from './index.js';

// =============================================================================
// Fixtures
// =============================================================================

const FILES = {
  './(default)/views/(default)/_route.js': {
    default: () => 'HomePage',
    getInitialProps: () => ({ title: 'Home' }),
  },
  './(default)/views/login/_route.js': {
    default: () => 'LoginPage',
    layout: 'unauth',
    getInitialProps: () => ({ title: 'Login' }),
  },
  './users/views/(admin)/(default)/_route.js': {
    default: () => 'UsersPage',
    getInitialProps: () => ({ title: 'Users' }),
  },
  './(default)/views/(layouts)/(unauth)/_layout.js': {
    default: ({ children }) => `unauth(${children})`,
  },
};

/**
 * Adapter whose load() is asynchronous, as a `mode: 'lazy'` webpack context
 * is, and which records which files were actually fetched.
 */
function createLazyAdapter() {
  const loaded = [];
  return {
    loaded,
    lazy: true,
    files: () => Object.keys(FILES),
    load: path => {
      loaded.push(path);
      return Promise.resolve(FILES[path]);
    },
  };
}

function createContext(pathname) {
  return {
    pathname,
    store: { getState: () => ({}), dispatch: () => {} },
    i18n: { t: (_key, fallback) => fallback },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('lazy view contexts', () => {
  it('builds the route tree without loading any module', () => {
    const adapter = createLazyAdapter();
    const router = new Router(adapter);

    expect(adapter.loaded).toEqual([]);

    const paths = [];
    const walk = routes =>
      routes.forEach(r => {
        paths.push(r.path);
        if (r.children) walk(r.children);
      });
    walk(router.routes);

    expect(paths).toContain('/');
    expect(paths).toContain('/login');
    expect(paths).toContain('/admin/users');
  });

  it('leaves deferred routes without an action until they are matched', () => {
    const router = new Router(createLazyAdapter());
    const login = router.routes
      .flatMap(r => [r, ...(r.children || [])])
      .find(r => r.path === '/login');

    expect(login).toBeDefined();
    expect(login.module).toBeUndefined();
    expect(typeof login.action).toBe('undefined');
    expect(typeof login.materialize).toBe('function');
  });

  it('loads only the matched route and its layout on resolve', async () => {
    const adapter = createLazyAdapter();
    const router = new Router(adapter);

    const page = await router.resolve(createContext('/login'));

    expect(page).toBeTruthy();
    expect(adapter.loaded).toContain('./(default)/views/login/_route.js');
    // The `layout: 'unauth'` export is only readable after the module loads,
    // so the layout is fetched as part of materialising the route.
    expect(adapter.loaded).toContain(
      './(default)/views/(layouts)/(unauth)/_layout.js',
    );
    // The admin view is never touched by a visitor on /login.
    expect(adapter.loaded).not.toContain(
      './users/views/(admin)/(default)/_route.js',
    );
  });

  it('materialises a route only once across repeated resolves', async () => {
    const adapter = createLazyAdapter();
    const router = new Router(adapter);

    await router.resolve(createContext('/login'));
    const afterFirst = adapter.loaded.length;
    await router.resolve(createContext('/login'));

    expect(adapter.loaded.length).toBe(afterFirst);
  });

  it('materializeTree loads every view, for server rendering', async () => {
    const adapter = createLazyAdapter();
    const router = new Router(adapter);

    await materializeTree(router.routes);

    expect(adapter.loaded).toContain(
      './users/views/(admin)/(default)/_route.js',
    );
    expect(adapter.loaded).toContain('./(default)/views/(default)/_route.js');
  });

  it('keeps an eager adapter on the immediate path', () => {
    const eager = {
      files: () => Object.keys(FILES),
      load: path => FILES[path],
    };
    const router = new Router(eager);
    const home = router.routes.find(r => r.path === '/');

    expect(typeof home.action).toBe('function');
    expect(home.materialize).toBeUndefined();
  });
});

describe('per-resolve view metadata', () => {
  it('records the extension namespaces the resolve activated', async () => {
    const router = new Router(createLazyAdapter());

    await router.resolve(createContext('/login'));

    // The login module exports no `namespace`, so the path stands in for it.
    // `/` is not walked: the home page is a sibling of `/login`, not its
    // section, so nothing about it is loaded or activated here.
    expect(router.viewNamespaces).toEqual(['/login']);
  });

  it('prefers a route module’s declared namespace over its path', async () => {
    const files = {
      './(default)/views/(default)/_route.js': { default: () => 'HomePage' },
      './(default)/views/login/_route.js': {
        default: () => 'LoginPage',
        namespace: 'login',
      },
    };
    const router = new Router({
      lazy: true,
      files: () => Object.keys(files),
      load: path => Promise.resolve(files[path]),
    });

    await router.resolve(createContext('/login'));

    expect(router.viewNamespaces).toContain('login');
    expect(router.viewNamespaces).not.toContain('/login');
  });

  it('reports the namespaces of the last resolve, not of every resolve', async () => {
    const router = new Router(createLazyAdapter());

    await router.resolve(createContext('/login'));
    await router.resolve(createContext('/admin/users'));

    expect(router.viewNamespaces).not.toContain('/login');
  });

  it('starts empty, before anything has been resolved', () => {
    expect(new Router(createLazyAdapter()).viewNamespaces).toEqual([]);
  });

  it('still clears after two navigations overlapped', async () => {
    // `resolve()` starts resolving immediately rather than waiting for the
    // queue, so a navigation begun before the previous one settles runs
    // alongside it rather than nested inside it, and raises the same nesting
    // counter. Restoring that counter to the value each pass entered with
    // left it stuck above zero once the two finished out of order — after
    // which no later pass was ever the outermost one and the metadata was
    // never cleared again.
    const files = {
      './(default)/views/(default)/_route.js': {
        default: () => 'HomePage',
        namespace: 'home',
      },
      './(default)/views/login/_route.js': {
        default: () => 'LoginPage',
        namespace: 'login',
      },
      './users/views/(admin)/(default)/_route.js': {
        default: () => 'UsersPage',
        namespace: 'users',
      },
    };
    const router = new Router({
      lazy: true,
      files: () => Object.keys(files),
      load: path => Promise.resolve(files[path]),
    });

    await Promise.allSettled([
      router.resolve(createContext('/login')),
      router.resolve(createContext('/admin/users')),
    ]);

    await router.resolve(createContext('/'));

    expect(router.viewNamespaces).toEqual(['home']);
  });
});

describe('mixed eager and lazy sources', () => {
  const CORE = {
    './(default)/views/(default)/_route.js': { default: () => 'HomePage' },
    './(default)/views/(layouts)/(unauth)/_layout.js': {
      default: ({ children }) => `unauth(${children})`,
    },
  };

  /** The application's own views: one chunk per route, so load() is async. */
  const lazyCore = () => ({
    lazy: true,
    files: () => Object.keys(CORE),
    load: path => Promise.resolve(CORE[path]),
  });

  /** An extension bundle: already downloaded, so load() is synchronous. */
  const eagerExtension = () => {
    const files = {
      './posts/views/manage/_route.js': {
        default: () => 'ManagePosts',
        // Borrows a layout that only the lazy core provides.
        layout: 'unauth',
      },
    };
    return {
      files: () => Object.keys(files),
      load: path => files[path],
    };
  };

  it('renders an eager route that borrows a layout from the lazy core', async () => {
    const router = new Router(lazyCore());
    await router.add(eagerExtension(), createContext('/'), 'posts');

    // Nothing has resolved yet, so the borrowed layout is still a thunk —
    // this is the deep link that used to throw reading `module.default`.
    const page = await router.resolve(createContext('/posts/manage'));

    expect(page).toBeTruthy();
    expect(page.component).toBeDefined();

    // The borrowed core layout was loaded as part of matching the route.
    // eslint-disable-next-line no-underscore-dangle
    const layout = router._layouts.get('(default):unauth');
    expect(layout.module).toBeDefined();
  });

  it('keeps the eager route usable by the setup/teardown traversal', async () => {
    const router = new Router(lazyCore());
    await router.add(eagerExtension(), createContext('/'), 'posts');

    const route = router.routes
      .flatMap(r => [r, ...(r.children || [])])
      .find(r => r.path === '/posts/manage');

    // `module` is present from the moment the route is built: traverseRoutes
    // reads it for the register/unregister lifecycle before any resolve.
    expect(route.module).toBeDefined();
    expect(typeof route.module.default).toBe('function');
  });
});

describe('nested resolves', () => {
  const FILES_404 = {
    './(default)/views/(default)/_route.js': { default: () => 'HomePage' },
    './(default)/views/not-found/_route.js': {
      default: () => 'NotFoundPage',
      namespace: 'not-found',
    },
  };

  const adapter = () => ({
    lazy: true,
    files: () => Object.keys(FILES_404),
    load: path => Promise.resolve(FILES_404[path]),
  });

  it('keeps the view metadata of the page a catch-all actually rendered', async () => {
    const router = new Router(adapter());
    // The application appends a hand-written catch-all that re-enters the
    // router with /not-found; see src/bootstrap/views.js.
    router.routes.push({
      path: '/:path*',
      action: ctx =>
        // eslint-disable-next-line no-underscore-dangle
        ctx._instance.resolve({ ...ctx, pathname: '/not-found' }),
    });

    const page = await router.resolve(createContext('/no/such/page'));

    expect(page).toBeTruthy();
    // The nested pass is what rendered, so its namespace and its source file
    // are the ones the server has to ship assets for.
    expect(router.viewNamespaces).toContain('not-found');
    expect(router.viewAssets).toContain(
      './(default)/views/not-found/_route.js',
    );
    // The synthetic catch-all names no view of its own.
    expect(router.viewNamespaces).not.toContain('/:path*');
  });

  it('does not carry metadata over from the previous navigation', async () => {
    const router = new Router(adapter());

    await router.resolve(createContext('/not-found'));
    await router.resolve(createContext('/'));

    expect(router.viewNamespaces).not.toContain('not-found');
  });

  it('keeps a nested pass metadata when the errorHandler renders elsewhere', async () => {
    // Three levels: /outer resolves /inner while mounting, then fails, and
    // the errorHandler resolves /error. Returning the handler's promise from
    // `catch` instead of awaiting it let `finally` drop the nesting depth to
    // zero as soon as the handler yielded, so the /error pass looked like a
    // fresh navigation and cleared what /inner had already recorded.
    const files = {
      './(default)/views/(default)/_route.js': { default: () => 'HomePage' },
      './(default)/views/outer/_route.js': {
        default: () => 'OuterPage',
        namespace: 'outer',
        mount: ctx =>
          // eslint-disable-next-line no-underscore-dangle
          ctx._instance.resolve({ ...createContext('/inner') }),
        middleware: () => {
          throw new Error('boom');
        },
      },
      './(default)/views/inner/_route.js': {
        default: () => 'InnerPage',
        namespace: 'inner',
      },
      './(default)/views/error/_route.js': {
        default: () => 'ErrorPage',
        namespace: 'error',
      },
    };

    const router = new Router(
      {
        lazy: true,
        files: () => Object.keys(files),
        load: path => Promise.resolve(files[path]),
      },
      {
        // A handler that does any async work before re-entering — the real
        // one reads the store and checks the error kind — hands control back
        // to the failed pass's `finally` before its own resolve starts.
        errorHandler: async (error, ctx) => {
          await Promise.resolve();
          // eslint-disable-next-line no-underscore-dangle
          return ctx._instance.resolve({ ...createContext('/error') });
        },
      },
    );

    const page = await router.resolve(createContext('/outer'));

    expect(page).toBeTruthy();
    expect(router.viewNamespaces).toContain('error');
    expect(router.viewNamespaces).toContain('inner');
  });
});
