/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';

import { getRegisteredEngines } from '../../shutdown.js';

import { InvalidBrokerTypeError } from './errors.js';
import { createFactory } from './factory.js';
import { createLazyBroker } from './lazy.js';

import broker, { MemoryBroker, RedisBroker } from './index.js';

describe('broker engine', () => {
  it('exposes the adapter interface from the singleton', () => {
    // Which adapter backs it depends on the environment this suite runs in,
    // so assert the contract rather than the class — a developer with
    // XNAPIFY_REDIS_URL exported should not see a red test here.
    for (const method of [
      'isConfigured',
      'getClient',
      'getKeyPrefix',
      'channel',
      'publish',
      'subscribe',
      'onReconnect',
      'cleanup',
    ]) {
      expect(typeof broker[method]).toBe('function');
    }
  });

  it('defaults to an in-process memory broker with no Redis configured', () => {
    expect(createFactory({ env: {} })).toBeInstanceOf(MemoryBroker);
  });

  it('rejects an unsupported adapter type', () => {
    expect(() => createFactory({ type: 'kafka' })).toThrow(
      InvalidBrokerTypeError,
    );
  });
});

describe('shutdown registration', () => {
  it('does not let a second adapter replace the first ones handler', () => {
    // The registry is keyed by name, so registering every adapter as
    // 'broker' would mean the last one built silently owns shutdown — and
    // the singleton's Redis connections would never be closed at exit.
    createFactory({ type: 'memory' });
    createFactory({ type: 'memory' });

    const registered = getRegisteredEngines().filter(name =>
      name.startsWith('broker'),
    );
    expect(registered.length).toBeGreaterThan(1);
    expect(registered).toContain('broker');
  });
});

describe('deferred adapter resolution', () => {
  // The engine singleton is built while `shared/api/index.js` evaluates its
  // engines context. Choosing the adapter there would snapshot `process.env`
  // before it is necessarily complete — the `*.worker.js` bundles are
  // separate entries that never load `dotenv-flow/config` — and the failure
  // is silent: the broker keeps the `memory` adapter for the life of the
  // process, leaving the session revocation set per-worker.
  const original = process.env.XNAPIFY_REDIS_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.XNAPIFY_REDIS_URL;
    else process.env.XNAPIFY_REDIS_URL = original;
  });

  it('reads the environment on first use, not at construction', () => {
    const lazy = createLazyBroker();

    // Configured only AFTER the facade exists — as a late dotenv load would.
    process.env.XNAPIFY_REDIS_URL = 'redis://127.0.0.1:6379/0';

    expect(lazy.adapter).toBeInstanceOf(RedisBroker);
    expect(lazy.isConfigured()).toBe(true);
  });

  it('resolves the adapter once and reuses it', () => {
    const lazy = createLazyBroker();
    expect(lazy.adapter).toBe(lazy.adapter);
  });

  it('cleans up without resolving an adapter it never needed', async () => {
    const lazy = createLazyBroker();
    await expect(lazy.cleanup()).resolves.toBeUndefined();
  });
});

describe('adapter auto-detection', () => {
  it('picks memory when XNAPIFY_REDIS_URL is not set', () => {
    expect(createFactory({ env: {} })).toBeInstanceOf(MemoryBroker);
  });

  it('picks redis when XNAPIFY_REDIS_URL is set', () => {
    const built = createFactory({ env: { XNAPIFY_REDIS_URL: 'redis://x' } });
    expect(built).toBeInstanceOf(RedisBroker);
  });

  it('an explicit type always wins over the environment', () => {
    const built = createFactory({
      type: 'memory',
      env: { XNAPIFY_REDIS_URL: 'redis://x' },
    });
    expect(built).toBeInstanceOf(MemoryBroker);
  });
});

describe('MemoryBroker', () => {
  it('reports no KV/lock backend, by design', () => {
    const instance = createFactory({ type: 'memory' });
    expect(instance.isConfigured()).toBe(false);
    expect(instance.getClient()).toBeNull();
    expect(typeof instance.onReconnect()).toBe('function');
  });

  it('delivers published messages to its own subscribers only', async () => {
    const a = createFactory({ type: 'memory' });
    const b = createFactory({ type: 'memory' });

    const receivedOnA = [];
    await a.subscribe('orders', payload => receivedOnA.push(payload));

    await a.publish('orders', 'hello');
    await b.publish('orders', 'ignored'); // different bus, no shared listeners

    expect(receivedOnA).toEqual(['hello']);
  });

  it('fans out across instances that share a bus', async () => {
    const bus = new EventEmitter();
    const a = createFactory({ type: 'memory', bus });
    const b = createFactory({ type: 'memory', bus });

    const received = [];
    await b.subscribe('orders', payload => received.push(payload));

    await a.publish('orders', 'hello');
    expect(received).toEqual(['hello']);
  });

  it('stops delivering once unsubscribed', async () => {
    const instance = createFactory({ type: 'memory' });
    const received = [];
    const unsubscribe = await instance.subscribe('orders', payload =>
      received.push(payload),
    );

    await instance.publish('orders', 'first');
    await unsubscribe();
    await instance.publish('orders', 'second');

    expect(received).toEqual(['first']);
  });

  it('does not deliver across unrelated channels', async () => {
    const instance = createFactory({ type: 'memory' });
    const received = [];
    await instance.subscribe('orders', payload => received.push(payload));

    await instance.publish('shipments', 'noise');

    expect(received).toEqual([]);
  });

  it('cleanup() drops only its own subscriptions on a shared bus', async () => {
    // The bus is shared to simulate several workers, so a cleanup that called
    // removeAllListeners() would silently tear down every other instance's
    // fan-out as well.
    const bus = new EventEmitter();
    const closing = createFactory({ type: 'memory', bus });
    const surviving = createFactory({ type: 'memory', bus });

    const onClosing = [];
    const onSurviving = [];
    await closing.subscribe('orders', payload => onClosing.push(payload));
    await surviving.subscribe('orders', payload => onSurviving.push(payload));

    await closing.cleanup();
    await surviving.publish('orders', 'after-cleanup');

    expect(onClosing).toEqual([]);
    expect(onSurviving).toEqual(['after-cleanup']);
  });
});
