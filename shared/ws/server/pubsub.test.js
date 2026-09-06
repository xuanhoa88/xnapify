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

describe('channel types', () => {
  let server;

  beforeEach(() => {
    server = new WebSocketServer({ enableLogging: false });
  });

  it('creates a private channel as PRIVATE, not PUBLIC', () => {
    // ChannelType.PRIVATE was missing from the enum, so this call passed
    // `undefined` as the type, _createChannel's default parameter made the
    // channel PUBLIC, and CHANNEL_SUBSCRIBE's ownership check compared
    // `channel.type` against `undefined` and never fired — any socket could
    // subscribe to another user's `user:<id>` channel.
    expect(ChannelType.PRIVATE).toBe('private');

    server.createPrivateChannel('user-1');
    const channel = server.channels.get('user:user-1');

    expect(channel.type).toBe(ChannelType.PRIVATE);
    expect(channel.type).not.toBe(ChannelType.PUBLIC);
    expect(channel.metadata.userId).toBe('user-1');
  });

  it('reaps a per-user channel once its last socket disconnects', () => {
    // createPrivateChannel runs on every authentication and deleteChannel had
    // no internal caller, so the map grew by one entry per distinct user and
    // held them for the life of the process.
    const socket = fakeSocket('s1', { id: 'user-1' });
    server.connections.set(socket.id, socket);
    server.createPrivateChannel('user-1');
    // eslint-disable-next-line no-underscore-dangle
    server._subscribeToChannel(socket, 'user:user-1');
    expect(server.channels.has('user:user-1')).toBe(true);

    // eslint-disable-next-line no-underscore-dangle
    server._handleClose(socket, 1000, Buffer.from('bye'));

    expect(server.channels.has('user:user-1')).toBe(false);
  });

  it('keeps the shared channels alive when a socket leaves', () => {
    // PUBLIC and PROTECTED are singletons created at start(); they must
    // outlive any one connection.
    const socket = fakeSocket('s2');
    server.connections.set(socket.id, socket);
    // eslint-disable-next-line no-underscore-dangle
    server._createChannel(ChannelType.PUBLIC, ChannelType.PUBLIC, {});
    // eslint-disable-next-line no-underscore-dangle
    server._subscribeToChannel(socket, ChannelType.PUBLIC);

    // eslint-disable-next-line no-underscore-dangle
    server._handleClose(socket, 1000, Buffer.from('bye'));

    expect(server.channels.has(ChannelType.PUBLIC)).toBe(true);
  });

  it('refuses a channel whose type it does not know', () => {
    // Failing closed is what stops a future channel kind from silently
    // becoming world-readable the way `private` did.
    // eslint-disable-next-line no-underscore-dangle
    expect(server._createChannel('odd', 'not-a-type', {})).toBe(false);
    expect(server.channels.has('odd')).toBe(false);
  });
});

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

describe('WebSocketServer fan-out isolation', () => {
  it('namespaces the default channel with the publisher key prefix', async () => {
    const { bus } = new MemoryRedisClient();

    const stagingPub = new MemoryRedisClient({ bus, keyPrefix: 'staging:' });
    const staging = new WebSocketServer({ enableLogging: false });
    await staging.attachPubSub({
      publisher: stagingPub,
      subscriber: stagingPub.duplicate({ keyPrefix: '' }),
      instanceId: 'staging-1',
    });

    const prodPub = new MemoryRedisClient({ bus, keyPrefix: 'prod:' });
    const prod = new WebSocketServer({ enableLogging: false });
    await prod.attachPubSub({
      publisher: prodPub,
      subscriber: prodPub.duplicate({ keyPrefix: '' }),
      instanceId: 'prod-1',
    });

    expect(staging.pubsub.channel).toBe('staging:ws:events');
    expect(prod.pubsub.channel).toBe('prod:ws:events');

    const prodSocket = fakeSocket('p1', { id: 42, sid: 'fam-prod' });
    connect(prod, prodSocket);

    // Same Redis, different deployments: staging must not kill prod's user 42
    staging.disconnectUser(42, 'Session revoked');
    await new Promise(resolve => setImmediate(resolve));
    expect(prodSocket.close).not.toHaveBeenCalled();

    await staging.detachPubSub();
    await prod.detachPubSub();
  });
});

describe('WebSocketServer attach/detach hygiene', () => {
  it('leaves pubsub unset when the subscription fails', async () => {
    const publisher = new MemoryRedisClient();
    const subscriber = publisher.duplicate();
    subscriber.subscribe = jest.fn(async () => {
      throw new Error('NOAUTH');
    });

    const server = new WebSocketServer({ enableLogging: false });
    await expect(
      server.attachPubSub({ publisher, subscriber }),
    ).rejects.toThrow('NOAUTH');

    expect(server.pubsub).toBeNull();
    // and the message listener must not linger on the shared subscriber
    expect(subscriber.listenerCount('message')).toBe(0);
  });

  it('does not apply remote events twice after a re-attach', async () => {
    const { bus } = new MemoryRedisClient();
    const sender = await makeWorker(bus, 'sender');

    const publisher = new MemoryRedisClient({ bus });
    const subscriber = publisher.duplicate();
    const server = new WebSocketServer({ enableLogging: false });
    await server.attachPubSub({ publisher, subscriber, instanceId: 'R' });
    await server.detachPubSub();
    await server.attachPubSub({ publisher, subscriber, instanceId: 'R' });

    const socket = fakeSocket('r1');
    connect(server, socket);

    sender.sendToPublicChannel('extension:updated', { type: 'X' });
    await new Promise(resolve => setImmediate(resolve));
    expect(socket.send).toHaveBeenCalledTimes(1);

    await sender.detachPubSub();
    await server.detachPubSub();
  });
});

describe('WebSocketServer revocation sweep', () => {
  let bus;
  let server;

  beforeEach(async () => {
    bus = new MemoryRedisClient().bus;
    server = await makeWorker(bus, 'S');
  });

  afterEach(async () => {
    server.stopRevocationSweep();
    await server.detachPubSub();
  });

  it('closes sockets whose session a dropped fan-out event missed', async () => {
    const revoked = fakeSocket('s1', { id: 7, sid: 'fam-1' });
    const live = fakeSocket('s2', { id: 8, sid: 'fam-2' });
    connect(server, revoked);
    connect(server, live);

    const publish = jest.spyOn(server.pubsub.publisher, 'publish');
    const isRevoked = jest.fn(async sid => sid === 'fam-1');

    await expect(server.sweepRevokedSessions(isRevoked)).resolves.toBe(1);
    expect(revoked.close).toHaveBeenCalledWith(
      CloseCode.POLICY_VIOLATION,
      'Session revoked',
    );
    expect(live.close).not.toHaveBeenCalled();
    // the sweep must not re-publish: every instance would multiply one kill
    expect(publish).not.toHaveBeenCalled();
  });

  it('keeps sockets open when the revocation store is unavailable', async () => {
    const socket = fakeSocket('s1', { id: 7, sid: 'fam-1' });
    connect(server, socket);

    const isRevoked = jest.fn(async () => {
      throw new Error('Redis down');
    });
    await expect(server.sweepRevokedSessions(isRevoked)).resolves.toBe(0);
    expect(socket.close).not.toHaveBeenCalled();
  });

  it('logs a failed revocation publish distinctly from a channel publish', async () => {
    const errors = [];
    server.logger.error = message => errors.push(String(message));
    server.pubsub.publisher.publish = jest.fn(async () => {
      throw new Error('connection lost');
    });

    server.disconnectSession('fam-1', 'Session revoked');
    server.sendToPublicChannel('noise', {});
    await new Promise(resolve => setImmediate(resolve));

    expect(errors.some(m => /Revocation fan-out failed/.test(m))).toBe(true);
    expect(
      errors.some(m => /^Fan-out publish failed \(channel\)/.test(m)),
    ).toBe(true);
  });

  it('starts and stops the periodic sweep', () => {
    expect(() => server.startRevocationSweep(null)).toThrow(TypeError);
    server.startRevocationSweep(() => false, { intervalMs: 10_000 });
    expect(server.revocationSweepTimer).not.toBeNull();
    server.stopRevocationSweep();
    expect(server.revocationSweepTimer).toBeNull();
  });
});
