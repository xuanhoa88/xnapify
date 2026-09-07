/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import { createFactory } from '../factory.js';
import { MemoryRedisClient } from '../memoryClient.js';

import RedisBroker from './redis.js';

function makePair(overrides = {}) {
  const client = new MemoryRedisClient({ keyPrefix: 'xnapify:', ...overrides });
  const subscriber = client.duplicate({ keyPrefix: '' });
  return { client, subscriber };
}

describe('RedisBroker configuration', () => {
  it('is disabled without a URL and never opens a connection', () => {
    const broker = new RedisBroker({ env: {} });
    expect(broker.isConfigured()).toBe(false);
    expect(broker.getClient()).toBeNull();

    const blank = new RedisBroker({ env: { XNAPIFY_REDIS_URL: '  ' } });
    expect(blank.isConfigured()).toBe(false);
  });

  it('reports configuration and normalises the key prefix from env', () => {
    expect(RedisBroker.isConfigured({ XNAPIFY_REDIS_URL: 'redis://x' })).toBe(
      true,
    );
    expect(RedisBroker.getKeyPrefix({})).toBe('xnapify:');
    expect(RedisBroker.getKeyPrefix({ XNAPIFY_REDIS_PREFIX: 'acme' })).toBe(
      'acme:',
    );
    expect(RedisBroker.getKeyPrefix({ XNAPIFY_REDIS_PREFIX: 'acme:' })).toBe(
      'acme:',
    );
  });

  it('is configured when a client is injected, even without env', () => {
    const { client, subscriber } = makePair();
    const broker = new RedisBroker({ env: {}, client, subscriber });
    expect(broker.isConfigured()).toBe(true);
    expect(broker.getClient()).toBe(client);
  });
});

describe('RedisBroker pub/sub', () => {
  it('throws instead of silently no-oping when unconfigured', async () => {
    const broker = new RedisBroker({ env: {} });
    await expect(broker.publish('orders', 'x')).rejects.toThrow(
      /not configured/,
    );
    await expect(broker.subscribe('orders', () => {})).rejects.toThrow(
      /not configured/,
    );
  });

  it('delivers messages published on the same channel only', async () => {
    const { client, subscriber } = makePair();
    const broker = new RedisBroker({ client, subscriber });

    const received = [];
    await broker.subscribe('orders', payload => received.push(payload));

    await broker.publish('orders', 'hello');
    await broker.publish('shipments', 'ignored');

    expect(received).toEqual(['hello']);
  });

  it('stops delivering and clears the listener once unsubscribed', async () => {
    const { client, subscriber } = makePair();
    const broker = new RedisBroker({ client, subscriber });

    const received = [];
    const unsubscribe = await broker.subscribe('orders', payload =>
      received.push(payload),
    );
    await broker.publish('orders', 'first');
    await unsubscribe();
    await broker.publish('orders', 'second');

    expect(received).toEqual(['first']);
    expect(subscriber.listenerCount('message')).toBe(0);
  });

  it('never leaves a listener behind when the subscription itself fails', async () => {
    const { client, subscriber } = makePair();
    subscriber.subscribe = jest.fn(async () => {
      throw new Error('NOAUTH');
    });
    const broker = new RedisBroker({ client, subscriber });

    await expect(broker.subscribe('orders', () => {})).rejects.toThrow(
      'NOAUTH',
    );
    expect(subscriber.listenerCount('message')).toBe(0);
  });

  it('namespaces channel names with the client key prefix', () => {
    const { client, subscriber } = makePair({ keyPrefix: 'staging:' });
    const broker = new RedisBroker({ client, subscriber });

    expect(broker.channel('ws:events')).toBe('staging:ws:events');
  });

  it('names a channel without opening a connection to do it', () => {
    // Asking for a name must not be what dials Redis: `channel()` is called
    // during bootstrap wiring and for log lines, well before any publish.
    const broker = new RedisBroker({
      env: {
        XNAPIFY_REDIS_URL: 'redis://127.0.0.1:6399',
        XNAPIFY_REDIS_PREFIX: 'acme',
      },
    });

    expect(broker.channel('ws:events')).toBe('acme:ws:events');
    expect(broker.client).toBeNull();
    expect(broker.ownsClient).toBe(false);
  });

  it('notifies onReconnect callbacks when the subscriber becomes ready', async () => {
    const { client, subscriber } = makePair();
    const broker = new RedisBroker({ client, subscriber });

    const seen = [];
    const stop = broker.onReconnect(() => seen.push('ready'));
    subscriber.emit('ready');
    expect(seen).toEqual(['ready']);

    stop();
    subscriber.emit('ready');
    expect(seen).toEqual(['ready']);
  });

  it('notifies onDisconnect when the subscriber connection dies for good', () => {
    // Otherwise the failure is silent: the consumer still believes it is
    // subscribed, nothing errors on the receive path, and remote messages
    // simply stop arriving.
    const { client, subscriber } = makePair();
    const broker = new RedisBroker({ client, subscriber });

    const seen = [];
    const stop = broker.onDisconnect(() => seen.push('end'));
    subscriber.emit('end');
    expect(seen).toEqual(['end']);

    stop();
    subscriber.emit('end');
    expect(seen).toEqual(['end']);
  });

  it('drops a dead subscriber it owns so the next subscribe rebuilds it', async () => {
    const { client } = makePair();
    const broker = new RedisBroker({ env: {}, client });

    const first = broker.ensureSubscriber();
    expect(broker.ownsSubscriber).toBe(true);

    first.emit('end'); // terminal: ioredis will not restore this socket

    expect(broker.subscriber).toBeNull();
    const second = broker.ensureSubscriber();
    expect(second).not.toBe(first);

    // and the replacement is live, with its lifecycle events bound
    const received = [];
    await broker.subscribe('orders', payload => received.push(payload));
    await broker.publish('orders', 'after-recovery');
    expect(received).toEqual(['after-recovery']);
  });

  it('leaves an injected subscriber in place when it ends', () => {
    // The pair belongs to whoever passed it in; replacing it is not ours.
    const { client, subscriber } = makePair();
    const broker = new RedisBroker({ client, subscriber });

    subscriber.emit('end');

    expect(broker.subscriber).toBe(subscriber);
  });
});

describe('RedisBroker cleanup', () => {
  it('never closes a connection it did not open itself', async () => {
    const { client, subscriber } = makePair();
    const closeClient = jest.spyOn(client, 'quit');
    const closeSubscriber = jest.spyOn(subscriber, 'quit');
    const broker = new RedisBroker({ client, subscriber });

    await broker.subscribe('orders', () => {});
    await broker.cleanup();

    expect(closeClient).not.toHaveBeenCalled();
    expect(closeSubscriber).not.toHaveBeenCalled();
  });

  it('force-disconnects an owned connection whose quit() fails', async () => {
    // `cleanup()` clears `this.client`/`this.subscriber` before the quit
    // promises settle, so a fallback that read those fields inside the catch
    // dereferenced null — the TypeError was swallowed by `allSettled` and the
    // socket was never force-closed, hanging shutdown on an open handle.
    const disconnected = [];
    const dead = name => ({
      options: { keyPrefix: 'x:' },
      quit: async () => {
        throw new Error('connection lost');
      },
      disconnect: () => disconnected.push(name),
      on() {},
      once() {},
      off() {},
    });

    const broker = new RedisBroker({
      env: {},
      client: dead('client'),
      subscriber: dead('subscriber'),
    });
    // The production path: connections this adapter opened for itself.
    broker.ownsClient = true;
    broker.ownsSubscriber = true;

    await broker.cleanup();

    expect(disconnected.sort()).toEqual(['client', 'subscriber']);
    expect(broker.client).toBeNull();
    expect(broker.subscriber).toBeNull();
  });
});

describe('RedisBroker via the factory', () => {
  it('is selectable explicitly', () => {
    const { client, subscriber } = makePair();
    const built = createFactory({ type: 'redis', client, subscriber });
    expect(built).toBeInstanceOf(RedisBroker);
  });

  it('is selected automatically when XNAPIFY_REDIS_URL is set', () => {
    const built = createFactory({ env: { XNAPIFY_REDIS_URL: 'redis://x' } });
    expect(built).toBeInstanceOf(RedisBroker);
  });
});
