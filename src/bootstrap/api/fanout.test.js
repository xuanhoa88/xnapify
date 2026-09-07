/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import { attachFanOut } from './fanout.js';

const RETRY_MS = 20;

/** Minimal WebSocket server: only what the fan-out lifecycle touches. */
function fakeWs({ failTimes = 0 } = {}) {
  let remaining = failTimes;
  const ws = {
    pubsub: null,
    attachPubSub: jest.fn(async ({ broker, channel }) => {
      if (remaining > 0) {
        remaining -= 1;
        throw new Error('NOAUTH');
      }
      ws.pubsub = { broker, channel };
    }),
    detachPubSub: jest.fn(async () => {
      ws.pubsub = null;
    }),
  };
  return ws;
}

/** Broker exposing the two lifecycle signals the fan-out subscribes to. */
function fakeBroker() {
  const reconnect = new Set();
  const disconnect = new Set();
  return {
    channel: name => name,
    onReconnect(callback) {
      reconnect.add(callback);
      return () => reconnect.delete(callback);
    },
    onDisconnect(callback) {
      disconnect.add(callback);
      return () => disconnect.delete(callback);
    },
    emitReconnect: () => reconnect.forEach(callback => callback()),
    emitDisconnect: () => disconnect.forEach(callback => callback()),
    hookCounts: () => ({
      reconnect: reconnect.size,
      disconnect: disconnect.size,
    }),
  };
}

/** Let queued microtasks and any due timers run. */
async function settle(ms = 0) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

describe('WebSocket fan-out lifecycle', () => {
  let started;

  afterEach(() => {
    if (started) started.stop();
    started = null;
  });

  it('attaches on start', async () => {
    const ws = fakeWs();
    const broker = fakeBroker();

    started = attachFanOut({ ws, broker, channel: 'ws:events' });
    await started.started;

    expect(ws.attachPubSub).toHaveBeenCalledWith({
      broker,
      channel: 'ws:events',
    });
    expect(ws.pubsub).not.toBeNull();
  });

  it('keeps serving and retries when the broker is unavailable', async () => {
    // Bootstrap must never fail on this: an outage during a rolling deploy
    // would otherwise stop every new pod from starting.
    const ws = fakeWs({ failTimes: 1 });
    const broker = fakeBroker();
    const logged = [];

    started = attachFanOut({
      ws,
      broker,
      channel: 'ws:events',
      retryMs: RETRY_MS,
      log: (message, level) => logged.push([level, message]),
    });
    await started.started;

    expect(ws.pubsub).toBeNull();
    expect(logged.some(([level]) => level === 'error')).toBe(true);

    await settle(RETRY_MS * 3);
    expect(ws.pubsub).not.toBeNull();
  });

  it('does not attach twice when already attached', async () => {
    // A second subscription would apply every remote event twice.
    const ws = fakeWs();
    const broker = fakeBroker();

    started = attachFanOut({ ws, broker, channel: 'ws:events' });
    await started.started;

    broker.emitReconnect();
    await settle();

    expect(ws.attachPubSub).toHaveBeenCalledTimes(1);
  });

  it('re-attaches on reconnect after a failed attach', async () => {
    const ws = fakeWs({ failTimes: 1 });
    const broker = fakeBroker();

    started = attachFanOut({ ws, broker, channel: 'ws:events' });
    await started.started;
    expect(ws.pubsub).toBeNull();

    broker.emitReconnect();
    await settle();

    expect(ws.pubsub).not.toBeNull();
  });

  it('detaches before re-attaching when the subscription dies', async () => {
    // The failure is silent: `ws.pubsub` stays truthy and nothing errors on
    // the receive path, so without detaching first `attach()` would take its
    // own `ws.pubsub` guard and no-op — recovery that looks like success.
    const ws = fakeWs();
    const broker = fakeBroker();
    const logged = [];

    started = attachFanOut({
      ws,
      broker,
      channel: 'ws:events',
      log: (message, level) => logged.push([level, message]),
    });
    await started.started;
    expect(ws.attachPubSub).toHaveBeenCalledTimes(1);

    broker.emitDisconnect();
    await settle();

    expect(ws.detachPubSub).toHaveBeenCalledTimes(1);
    expect(ws.attachPubSub).toHaveBeenCalledTimes(2);
    expect(ws.pubsub).not.toBeNull();
    expect(
      logged.some(
        ([level, message]) =>
          level === 'error' && /lost its subscription/.test(message),
      ),
    ).toBe(true);
  });

  it('recovers even if detaching throws', async () => {
    const ws = fakeWs();
    ws.detachPubSub = jest.fn(async () => {
      ws.pubsub = null;
      throw new Error('already closed');
    });
    const broker = fakeBroker();

    started = attachFanOut({ ws, broker, channel: 'ws:events' });
    await started.started;

    broker.emitDisconnect();
    await settle();

    expect(ws.attachPubSub).toHaveBeenCalledTimes(2);
  });

  it('stop() cancels the retry and removes both broker hooks', async () => {
    const ws = fakeWs({ failTimes: 10 });
    const broker = fakeBroker();

    const fanOut = attachFanOut({
      ws,
      broker,
      channel: 'ws:events',
      retryMs: RETRY_MS,
    });
    await fanOut.started;
    expect(broker.hookCounts()).toEqual({ reconnect: 1, disconnect: 1 });

    fanOut.stop();
    const attemptsAtStop = ws.attachPubSub.mock.calls.length;

    await settle(RETRY_MS * 3);

    expect(ws.attachPubSub).toHaveBeenCalledTimes(attemptsAtStop);
    expect(broker.hookCounts()).toEqual({ reconnect: 0, disconnect: 0 });
  });
});
