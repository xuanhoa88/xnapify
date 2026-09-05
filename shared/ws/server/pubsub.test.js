/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import { MemoryRedisClient } from '@shared/api/engines/redis/memoryClient.js';

import { WebSocketServer, ChannelType, CloseCode } from './index.js';

const OPEN = 1;

function fakeSocket(id, user) {
  return { id, readyState: OPEN, send: jest.fn(), close: jest.fn(), user };
}

async function makeWorker(bus, instanceId) {
  const server = new WebSocketServer({ enableLogging: false });
  const publisher = new MemoryRedisClient({ bus });
  const subscriber = publisher.duplicate();
  await server.attachPubSub({ publisher, subscriber, instanceId });
  return server;
}

function connect(server, socket) {
  server.connections.set(socket.id, socket);
  if (!server.channels.has(ChannelType.PUBLIC)) {
    // eslint-disable-next-line no-underscore-dangle
    server._createChannel(ChannelType.PUBLIC, ChannelType.PUBLIC, {});
  }
  // eslint-disable-next-line no-underscore-dangle
  server._subscribeToChannel(socket, ChannelType.PUBLIC);
  if (socket.user) {
    server.createPrivateChannel(socket.user.id);
    // eslint-disable-next-line no-underscore-dangle
    server._subscribeToChannel(socket, `user:${socket.user.id}`);
  }
}

describe('WebSocketServer fan-out', () => {
  let bus;
  let a;
  let b;

  beforeEach(async () => {
    bus = new MemoryRedisClient().bus;
    a = await makeWorker(bus, 'A');
    b = await makeWorker(bus, 'B');
  });

  afterEach(async () => {
    await a.detachPubSub();
    await b.detachPubSub();
  });

  it('delivers channel messages to subscribers on other instances exactly once', async () => {
    const onA = fakeSocket('a1');
    const onB = fakeSocket('b1');
    connect(a, onA);
    connect(b, onB);

    a.sendToPublicChannel('extension:updated', { type: 'X' });
    await new Promise(resolve => setImmediate(resolve));

    expect(onA.send).toHaveBeenCalledTimes(1);
    expect(onB.send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(onB.send.mock.calls[0][0]);
    expect(payload.data).toMatchObject({
      channel: ChannelType.PUBLIC,
      type: 'extension:updated',
      data: { type: 'X' },
    });
  });

  it('reaches a private channel that only exists on another instance', async () => {
    const onB = fakeSocket('b1', { id: 42 });
    connect(b, onB);

    // Worker A has no channel for user 42 locally
    expect(a.sendToPrivateChannel(42, 'notice', { hi: true })).toBe(0);
    await new Promise(resolve => setImmediate(resolve));
    expect(onB.send).toHaveBeenCalledTimes(1);
  });

  it('closes sockets of a revoked session and user on every instance', async () => {
    const sessionOnB = fakeSocket('b1', { id: 7, sid: 'fam-1' });
    const otherOnB = fakeSocket('b2', { id: 8, sid: 'fam-2' });
    connect(b, sessionOnB);
    connect(b, otherOnB);

    a.disconnectSession('fam-1', 'Session revoked');
    await new Promise(resolve => setImmediate(resolve));
    expect(sessionOnB.close).toHaveBeenCalledWith(
      CloseCode.POLICY_VIOLATION,
      'Session revoked',
    );
    expect(otherOnB.close).not.toHaveBeenCalled();

    a.disconnectUser(8, 'Signed out everywhere');
    await new Promise(resolve => setImmediate(resolve));
    expect(otherOnB.close).toHaveBeenCalledWith(
      CloseCode.POLICY_VIOLATION,
      'Signed out everywhere',
    );
  });

  it('validates clients and stops after detach', async () => {
    const lone = new WebSocketServer({ enableLogging: false });
    await expect(lone.attachPubSub({})).rejects.toThrow(TypeError);

    const onB = fakeSocket('b1');
    connect(b, onB);
    await b.detachPubSub();
    a.sendToPublicChannel('x', {});
    await new Promise(resolve => setImmediate(resolve));
    expect(onB.send).not.toHaveBeenCalled();
  });
});
