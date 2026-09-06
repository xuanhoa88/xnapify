/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import RouteTable, { ROUTER_KEYS, toRouterKey } from './RouteTable.js';

const makeRouter = () => ({ add: jest.fn(), remove: jest.fn() });

describe('toRouterKey', () => {
  it('maps api to api and everything else to views', () => {
    expect(toRouterKey('api')).toBe('api');
    expect(toRouterKey('views')).toBe('views');
    expect(toRouterKey('view')).toBe('views');
    expect(toRouterKey(undefined)).toBe('views');
  });

  it('knows exactly two routers', () => {
    expect([...ROUTER_KEYS]).toEqual(['views', 'api']);
  });
});

describe('RouteTable buffering', () => {
  let table;

  beforeEach(() => {
    table = new RouteTable();
  });

  it('starts with no routers connected', () => {
    expect(table.routerFor('views')).toBeNull();
    expect(table.routerFor('api')).toBeNull();
  });

  it('reports pending adapters through has()', () => {
    table.buffer('ext-a', { id: 1 }, 'views');
    expect(table.has('views')).toBe(true);
    expect(table.has('api')).toBe(false);
  });

  it('replays buffered adapters when the router connects', () => {
    const adapter = { id: 1 };
    table.buffer('ext-a', adapter, 'views');

    const router = makeRouter();
    table.connect('views', router);

    expect(router.add).toHaveBeenCalledWith(adapter);
  });

  it('leaves adapters for other routers buffered', () => {
    table.buffer('ext-a', { id: 'v' }, 'views');
    table.buffer('ext-a', { id: 'a' }, 'api');

    const viewRouter = makeRouter();
    table.connect('views', viewRouter);

    expect(viewRouter.add).toHaveBeenCalledTimes(1);
    expect(table.has('api')).toBe(true);

    const apiRouter = makeRouter();
    table.connect('api', apiRouter);
    expect(apiRouter.add).toHaveBeenCalledWith({ id: 'a' });
  });

  it('replays stored adapters again when a router reconnects', () => {
    const adapter = { id: 1 };
    table.store('ext-a', adapter, 'views');

    const first = makeRouter();
    table.connect('views', first);
    const second = makeRouter();
    table.connect('views', second);

    expect(first.add).toHaveBeenCalledWith(adapter);
    expect(second.add).toHaveBeenCalledWith(adapter);
  });

  it('uses a custom injector when given one', () => {
    const inject = jest.fn();
    table.store('ext-a', { id: 1 }, 'views');
    const router = makeRouter();

    table.connect('views', router, inject);

    expect(inject).toHaveBeenCalledWith(router, { id: 1 }, 'ext-a');
    expect(router.add).not.toHaveBeenCalled();
  });

  it('connecting a null router still drains the buffer', () => {
    table.buffer('ext-a', { id: 1 }, 'views');
    table.connect('views', null);
    expect(table.has('views')).toBe(true); // now stored rather than pending
  });
});

describe('RouteTable removal', () => {
  let table;
  let router;

  beforeEach(() => {
    table = new RouteTable();
    router = makeRouter();
  });

  it('withdraws a live adapter from its router', async () => {
    const adapter = { id: 1 };
    table.store('ext-a', adapter, 'views');
    table.connect('views', router);

    await table.remove('ext-a');

    expect(router.remove).toHaveBeenCalledWith(adapter);
    expect(table.has('views')).toBe(false);
  });

  it('drops buffered adapters so they are never replayed', async () => {
    // A stale buffered adapter would otherwise be injected on connect, long
    // after the extension that produced it was unloaded.
    table.buffer('ext-a', { id: 1 }, 'views');

    await table.remove('ext-a');
    table.connect('views', router);

    expect(router.add).not.toHaveBeenCalled();
  });

  it('leaves other extensions alone', async () => {
    table.store('ext-a', { id: 'a' }, 'views');
    table.store('ext-b', { id: 'b' }, 'views');
    table.connect('views', router);

    await table.remove('ext-a');

    expect(table.has('views')).toBe(true);
  });

  it('reports a failing removal instead of throwing', async () => {
    const onError = jest.fn();
    router.remove.mockImplementation(() => {
      throw new Error('router stuck');
    });
    table.store('ext-a', { id: 1 }, 'views');
    table.connect('views', router);

    await expect(
      table.remove('ext-a', undefined, onError),
    ).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'views');
    // The reference is still dropped, so a stuck router cannot pin it forever
    expect(table.has('views')).toBe(false);
  });

  it('still removes the api adapter when the view removal fails', async () => {
    const apiRouter = makeRouter();
    router.remove.mockImplementation(() => {
      throw new Error('router stuck');
    });
    table.store('ext-a', { id: 'v' }, 'views');
    table.store('ext-a', { id: 'a' }, 'api');
    table.connect('views', router);
    table.connect('api', apiRouter);

    await table.remove('ext-a', undefined, jest.fn());

    expect(apiRouter.remove).toHaveBeenCalledWith({ id: 'a' });
  });

  it('removing an unknown extension is a no-op', async () => {
    await expect(table.remove('missing')).resolves.toBeUndefined();
  });

  it('reset forgets routers and adapters', () => {
    table.store('ext-a', { id: 1 }, 'views');
    table.buffer('ext-b', { id: 2 }, 'api');
    table.connect('views', router);

    table.reset();

    expect(table.routerFor('views')).toBeNull();
    expect(table.has('views')).toBe(false);
    expect(table.has('api')).toBe(false);
  });
});
