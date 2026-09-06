/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Runtime activation/deactivation of a module-type extension.
 *
 * Mirrors what ClientExtensionManager does on an EXTENSION_ACTIVATED /
 * EXTENSION_DEACTIVATED WebSocket event:
 *   activate   → router.add(adapter, router._lastResolveContext, id)
 *   deactivate → router.remove(id, router._lastResolveContext)
 *
 * An extension that registers its sidebar entry from a route `setup()` hook
 * depends entirely on those two traversals firing.
 */

import { Router } from './index.js';

const CORE_FILES = {
  './(default)/views/(default)/_route.js': { default: () => 'HomePage' },
  './(default)/views/(layouts)/(admin)/_layout.js': {
    default: ({ children }) => `admin(${children})`,
  },
  './users/views/(admin)/(default)/_route.js': { default: () => 'UsersPage' },
};

/** The application's own views: lazily chunked, one module per route. */
function createLazyCore() {
  return {
    lazy: true,
    files: () => Object.keys(CORE_FILES),
    load: path => Promise.resolve(CORE_FILES[path]),
  };
}

/**
 * A module-type extension bundle. Eager: the whole extension arrives as one
 * Module Federation container, so every route module is present up front.
 */
function createExtension(calls) {
  const files = {
    './posts/views/(admin)/(default)/_route.js': {
      default: () => 'PostsPage',
      setup: ctx => calls.push(['setup', ctx]),
      teardown: ctx => calls.push(['teardown', ctx]),
    },
  };
  return {
    files: () => Object.keys(files),
    load: path => files[path],
  };
}

function createContext(pathname) {
  return {
    pathname,
    store: { getState: () => ({}), dispatch: () => {} },
    i18n: { t: (_key, fallback) => fallback },
  };
}

describe('extension activation and the route setup/teardown traversal', () => {
  it('runs setup() when an extension is added after a resolve', async () => {
    const calls = [];
    const router = new Router(createLazyCore());

    // The admin page the operator is looking at when they flip the switch.
    await router.resolve(createContext('/admin/users'));
    // eslint-disable-next-line no-underscore-dangle
    const ctx = router._lastResolveContext;
    expect(ctx).toBeTruthy();

    await router.add(createExtension(calls), ctx, 'posts-module');

    expect(calls.map(c => c[0])).toEqual(['setup']);
  });

  it('hands setup() a context carrying store and i18n', async () => {
    const calls = [];
    const router = new Router(createLazyCore());
    await router.resolve(createContext('/admin/users'));

    await router.add(
      createExtension(calls),
      // eslint-disable-next-line no-underscore-dangle
      router._lastResolveContext,
      'posts-module',
    );

    const [, setupCtx] = calls[0];
    expect(setupCtx.store).toBeDefined();
    expect(typeof setupCtx.store.dispatch).toBe('function');
    expect(setupCtx.i18n).toBeDefined();
  });

  it('runs teardown() when the extension is removed by source id', async () => {
    const calls = [];
    const router = new Router(createLazyCore());
    await router.resolve(createContext('/admin/users'));
    // eslint-disable-next-line no-underscore-dangle
    const ctx = router._lastResolveContext;

    await router.add(createExtension(calls), ctx, 'posts-module');
    calls.length = 0;

    await router.remove('posts-module', ctx);

    expect(calls.map(c => c[0])).toEqual(['teardown']);
  });

  it('still runs setup() when the extension is added before any resolve', async () => {
    // A plugin activated before the first navigation completes: the manager
    // has no resolve context to hand over.
    const calls = [];
    const router = new Router(createLazyCore());

    // eslint-disable-next-line no-underscore-dangle
    expect(router._lastResolveContext).toBeUndefined();
    // eslint-disable-next-line no-underscore-dangle
    await router.add(createExtension(calls), router._lastResolveContext, 'p');

    // Nothing ran yet — add() had no context to pass to the traversal.
    expect(calls).toHaveLength(0);

    await router.resolve(createContext('/'));

    // The first resolve drains _pendingRoutes AND runs the one-time full-tree
    // setup(), so a route added this way sees setup twice. Registration hooks
    // must therefore be idempotent — registerMenu overwrites by section id and
    // item path, which is what makes this safe.
    expect(calls.map(c => c[0])).toEqual(['setup', 'setup']);
  });
});
