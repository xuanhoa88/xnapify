/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * One compiled route tree, many requests.
 *
 * The server builds the tree once (`compileServerViews()` in
 * src/bootstrap/views.js) and hands the same route nodes to a fresh Router for
 * every request, while `createReduxStore` builds a fresh store per request.
 * Anything a route hook installs into the request — a reducer, an i18n
 * namespace — must therefore be remembered on the request context and never
 * on the shared node.
 */

import { addNamespace } from '@shared/i18n/utils.js';

import { materializeTree } from './builder.js';

import { Router } from './index.js';

jest.mock('@shared/i18n/utils.js', () => ({
  addNamespace: jest.fn(),
}));

jest.mock('@shared/i18n/loader.js', () => ({
  __esModule: true,
  getTranslations: jest.fn(val => val),
}));

const FILES = {
  './(default)/views/(default)/_route.js': { default: () => 'HomePage' },
  './files/views/(admin)/(default)/_route.js': {
    default: () => 'FilesPage',
    // The pattern every admin view follows: the slice the page renders from
    // is injected by init(), into the store of the request being served.
    init: ({ store }) => store.injectReducer('files'),
    translations: () => ({ 'en-US': { title: 'Files' } }),
    getInitialProps: () => ({ title: 'Files' }),
  },
};

/** The application's own views: lazily chunked, so load() is async. */
const createAdapter = () => ({
  lazy: true,
  files: () => Object.keys(FILES),
  load: path => Promise.resolve(FILES[path]),
});

/** A per-request store, as configureStore() hands out. */
function createStore() {
  const injected = [];
  return {
    injected,
    injectReducer: key => injected.push(key),
    getState: () => ({}),
    dispatch: () => {},
  };
}

const createContext = (pathname, store) => ({
  pathname,
  store,
  i18n: { t: (_key, fallback) => fallback },
});

/**
 * What the server does at boot: build the tree, load every view, then share
 * `routes` and `layouts` with each request's Router.
 */
async function compile() {
  const router = new Router(createAdapter());
  await materializeTree(router.routes);
  // eslint-disable-next-line no-underscore-dangle
  return { routes: router.routes, layouts: router._layouts };
}

describe('a route tree shared across requests', () => {
  beforeEach(() => {
    const { getTranslations } = require('@shared/i18n/loader.js');
    getTranslations.mockImplementation(val => val);
  });

  it('runs init() for every request, not only the first', async () => {
    const compiled = await compile();

    const first = new Router(createAdapter(), { compiled });
    const second = new Router(createAdapter(), { compiled });

    const storeA = createStore();
    const storeB = createStore();

    await first.resolve(createContext('/admin/files', storeA));
    await second.resolve(createContext('/admin/files', storeB));

    // Memoising init on the route node injected the reducer into the first
    // request's store only; every later request then rendered /admin/files
    // against a store with no `files` slice.
    expect(storeA.injected).toEqual(['files']);
    expect(storeB.injected).toEqual(['files']);
  });

  it('registers route translations for every request, not only the first', async () => {
    const compiled = await compile();

    const first = new Router(createAdapter(), { compiled });
    const second = new Router(createAdapter(), { compiled });

    await first.resolve(createContext('/admin/files', createStore()));
    const afterFirst = addNamespace.mock.calls.length;
    await second.resolve(createContext('/admin/files', createStore()));

    expect(afterFirst).toBeGreaterThan(0);
    expect(addNamespace.mock.calls.length).toBeGreaterThan(afterFirst);
    expect(addNamespace).toHaveBeenLastCalledWith('files', {
      'en-US': { title: 'Files' },
    });
  });

  it('leaves no per-request state on the shared route nodes', async () => {
    const compiled = await compile();
    const router = new Router(createAdapter(), { compiled });

    await router.resolve(createContext('/admin/files', createStore()));

    const files = compiled.routes
      .flatMap(r => [r, ...(r.children || [])])
      .find(r => r.path === '/admin/files');

    expect(files).toBeDefined();
    // Only the cached parent→child hierarchy, which is derived from the tree
    // itself and identical for every request, may live on a node.
    const perRequest = Object.getOwnPropertySymbols(files).filter(sym =>
      /route\.(init|translations)__/.test(String(sym)),
    );
    expect(perRequest).toEqual([]);
  });

  it('still runs init once per navigation on a long-lived client router', async () => {
    const router = new Router(createAdapter());
    const store = createStore();

    await router.resolve(createContext('/admin/files', store));

    // One navigation matches the route several times as the resolver walks
    // the tree; init must not fire once per match.
    expect(store.injected).toEqual(['files']);
  });
});
