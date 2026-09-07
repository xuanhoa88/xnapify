/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * The only tests in this repository that talk to a real Redis.
 *
 * Every other Redis-path test runs against `MemoryRedisClient`, a stand-in
 * written alongside the code it verifies — so it can only confirm that the
 * adapter matches our idea of ioredis, never that our idea is right. These
 * cover what a stand-in structurally cannot: that `ensureClient()` /
 * `ensureSubscriber()` produce connections that actually work, that a
 * dedicated subscriber connection really is required, and that `keyPrefix`
 * genuinely does not apply to PUBLISH/SUBSCRIBE — the assumption the whole
 * deployment-isolation story rests on.
 *
 * Opt-in, because they need a server:
 *
 *     XNAPIFY_TEST_REDIS_URL=redis://127.0.0.1:6379/15 npm test -- redis.integration
 *
 * Without it Jest reports them as skipped rather than passing silently. The
 * variable is test-only — it is deliberately absent from the runtime schema
 * in `shared/config/env.js`, which validates what the *server* reads, and it
 * is intentionally NOT `XNAPIFY_REDIS_URL`: reusing that would point these
 * writes at whatever Redis a developer had configured for real work.
 *
 * Every key and channel is namespaced with a per-run random prefix, so a
 * shared server is safe and nothing needs flushing.
 */

import { randomUUID } from 'crypto';

import RedisBroker from './redis.js';

const REDIS_URL = process.env.XNAPIFY_TEST_REDIS_URL;
const describeWithRedis = REDIS_URL ? describe : describe.skip;

/** Wait for `check()`, giving a real server time to deliver. */
async function until(check, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (check()) return true;

    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return false;
}

describeWithRedis('RedisBroker against a real Redis', () => {
  const open = [];
  let prefix;

  function makeBroker(overrides = {}) {
    const broker = new RedisBroker({
      env: {
        XNAPIFY_REDIS_URL: REDIS_URL,
        XNAPIFY_REDIS_PREFIX: prefix,
        ...overrides,
      },
    });
    open.push(broker);
    return broker;
  }

  beforeEach(() => {
    // Namespaced per run so a shared server needs no flushing.
    prefix = `xnapify-test-${randomUUID().slice(0, 8)}:`;
  });

  afterEach(async () => {
    await Promise.all(open.splice(0).map(broker => broker.cleanup()));
  }, 15000);

  it('delivers a message between two independent connections', async () => {
    const publisher = makeBroker();
    const subscriber = makeBroker();
    const channel = publisher.channel('ws:events');

    const received = [];
    await subscriber.subscribe(channel, payload => received.push(payload));
    await publisher.publish(channel, 'hello');

    expect(await until(() => received.length > 0)).toBe(true);
    expect(received).toEqual(['hello']);
  }, 15000);

  it('keeps two deployments on one server apart', async () => {
    // Redis applies no key prefix to PUBLISH/SUBSCRIBE and does not scope
    // pub/sub per database, so the namespaced channel name is the only
    // thing stopping staging from closing production's sockets.
    const staging = makeBroker({ XNAPIFY_REDIS_PREFIX: `${prefix}staging:` });
    const production = makeBroker({ XNAPIFY_REDIS_PREFIX: `${prefix}prod:` });

    const onProduction = [];
    await production.subscribe(production.channel('ws:events'), payload =>
      onProduction.push(payload),
    );
    await staging.publish(staging.channel('ws:events'), 'staging-only');

    // Give it real time to arrive before concluding it did not.
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(onProduction).toEqual([]);
  }, 15000);

  it('hands out a working KV client for the stores that need one', async () => {
    const broker = makeBroker();
    const client = broker.getClient();

    // The escape hatch the cache, rate limiter, revocation store and cron
    // lock all rely on — including that keyPrefix applies to normal
    // commands, unlike pub/sub.
    await client.set('probe', 'value', 'PX', 5000);
    expect(await client.get('probe')).toBe('value');
    expect(await client.set('probe', 'again', 'PX', 5000, 'NX')).toBeNull();

    await client.del('probe');
    expect(await client.get('probe')).toBeNull();
  }, 15000);

  it('stops delivering after unsubscribe, and closes what it opened', async () => {
    const publisher = makeBroker();
    const subscriber = makeBroker();
    const channel = publisher.channel('ws:events');

    const received = [];
    const unsubscribe = await subscriber.subscribe(channel, payload =>
      received.push(payload),
    );
    await publisher.publish(channel, 'first');
    expect(await until(() => received.length > 0)).toBe(true);

    await unsubscribe();
    await publisher.publish(channel, 'second');
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(received).toEqual(['first']);

    await subscriber.cleanup();
    expect(subscriber.client).toBeNull();
    expect(subscriber.subscriber).toBeNull();
  }, 15000);
});
