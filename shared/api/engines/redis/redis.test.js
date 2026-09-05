/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { MemoryRedisClient } from './memoryClient.js';

import redis, {
  getRedisClient,
  getRedisKeyPrefix,
  isRedisConfigured,
} from './index.js';

describe('redis engine', () => {
  it('is disabled without a URL and never opens a connection', () => {
    expect(isRedisConfigured({})).toBe(false);
    expect(isRedisConfigured({ XNAPIFY_REDIS_URL: '  ' })).toBe(false);
    expect(getRedisClient({})).toBeNull();
    expect(redis.getSubscriber({})).toBeNull();
  });

  it('reports configuration and normalises the key prefix', () => {
    expect(isRedisConfigured({ XNAPIFY_REDIS_URL: 'redis://x' })).toBe(true);
    expect(getRedisKeyPrefix({})).toBe('xnapify:');
    expect(getRedisKeyPrefix({ XNAPIFY_REDIS_PREFIX: 'acme' })).toBe('acme:');
    expect(getRedisKeyPrefix({ XNAPIFY_REDIS_PREFIX: 'acme:' })).toBe('acme:');
  });
});

describe('MemoryRedisClient', () => {
  it('implements the command subset with prefixes and TTLs', async () => {
    const client = new MemoryRedisClient({ keyPrefix: 'p:' });
    expect(await client.set('a', '1', 'PX', 50)).toBe('OK');
    expect(await client.get('a')).toBe('1');
    expect(await client.exists('a', 'b')).toBe(1);
    expect(client.store.has('p:a')).toBe(true);

    expect(await client.set('a', '2', 'NX')).toBeNull();
    expect(await client.incr('n')).toBe(1);
    expect(await client.incr('n')).toBe(2);

    const [, keys] = await client.scan('0', 'MATCH', 'p:*', 'COUNT', 10);
    expect(keys.sort()).toEqual(['p:a', 'p:n']);

    await new Promise(resolve => setTimeout(resolve, 60));
    expect(await client.get('a')).toBeNull();
    expect(await client.del('n', 'missing')).toBe(1);
    expect(await client.call('GET', 'n')).toBeNull();
    await expect(client.call('FLUSHALL')).rejects.toThrow('unsupported');
  });

  it('shares pub/sub and storage across duplicates', async () => {
    const a = new MemoryRedisClient();
    const b = a.duplicate();
    const received = [];
    b.on('message', (channel, message) => received.push([channel, message]));
    await b.subscribe('events');

    await a.publish('events', 'hello');
    await a.publish('other', 'ignored');
    expect(received).toEqual([['events', 'hello']]);

    await a.set('shared', 'yes');
    expect(await b.get('shared')).toBe('yes');

    await b.quit();
    await a.publish('events', 'after-quit');
    expect(received).toHaveLength(1);
  });
});
