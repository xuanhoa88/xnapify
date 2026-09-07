/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { MemoryRedisClient } from '../../broker/memoryClient.js';
import { createFactory, withNamespace } from '../factory.js';

import RedisCache from './redis.js';

describe('RedisCache', () => {
  let client;
  let cache;

  beforeEach(() => {
    client = new MemoryRedisClient({ keyPrefix: 'xnapify:' });
    cache = new RedisCache({ client, ttl: 1000 });
  });

  it('round-trips JSON values with a TTL', async () => {
    await cache.set('user:1', { id: 1, tags: ['a'] });
    expect(await cache.get('user:1')).toEqual({ id: 1, tags: ['a'] });
    expect(await cache.has('user:1')).toBe(true);
    expect(await cache.get('missing')).toBeNull();
    expect(client.store.has('xnapify:cache:user:1')).toBe(true);

    await cache.set('short', 'x', 1);
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(await cache.get('short')).toBeNull();
  });

  it('enumerates and clears only its own keys', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);
    await client.set('unrelated', 'x');

    expect((await cache.keys()).sort()).toEqual(['a', 'b']);
    expect(await cache.clear()).toBe(2);
    expect(await cache.keys()).toEqual([]);
    expect(await client.get('unrelated')).toBe('x');
    expect(await cache.delete('a')).toBe(false);
  });

  it('supports namespaces and the factory type', async () => {
    const ns = withNamespace('ext', cache);
    await ns.set('k', 'v');
    expect(await cache.get('ext:k')).toBe('v');
    await ns.clear();
    expect(await cache.get('ext:k')).toBeNull();

    const built = createFactory({ type: 'redis', client, ttl: 500 });
    expect(built).toBeInstanceOf(RedisCache);
    expect(typeof built.withNamespace).toBe('function');
    expect((await built.stats()).type).toBe('redis');
    expect(built.cleanup()).toBe(0);
  });

  it('requires a client', () => {
    expect(() => new RedisCache({})).toThrow(TypeError);
  });

  it('does not expose the raw connection as a property', () => {
    // `broker` is a privileged capability precisely because getClient() is a
    // raw connection to the session denylist and the rate-limit counters —
    // writing through it is enough to un-revoke a revoked session. `cache` is
    // a *default* capability that every extension holds without asking. If a
    // cache instance carried the same connection on a public property, the
    // broker gate would be decorative: `container.resolve('cache').client`
    // reaches the identical surface. The prefixing that makes this adapter
    // "scoped by construction" only applies to its own methods.
    expect(cache.client).toBeUndefined();
    expect(Object.values(cache)).not.toContain(client);
    expect(JSON.stringify(Object.keys(cache))).not.toMatch(/client/i);
  });
});
