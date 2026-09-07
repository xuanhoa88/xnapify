/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { DEFAULT_CONCURRENCY } from '@shared/utils/atomic/index.js';

import { createFactory } from '../factory.js';

import FileBroker from './file.js';

const POLL = 15;

/**
 * Scripts run in a genuinely separate OS process, with its own filesystem
 * view — several adapter instances inside one process share a page cache and
 * an event loop, so they cannot demonstrate the cross-process delivery this
 * adapter exists for.
 *
 * They use only Node builtins (no `@shared` aliases to resolve) and they pin
 * the on-disk contract deliberately: a filename of
 * `<13-digit ms>-<6-digit seq>-<pid>-<hex>.msg`, written aside and renamed
 * in. If that format changes, these fail — which is the point.
 */
const CHILD_PUBLISHES = `
  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');
  const dir = process.env.CHANNEL_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const name =
    String(Date.now()).padStart(13, '0') + '-' +
    String(1).padStart(6, '0') + '-' +
    process.pid + '-' + crypto.randomBytes(3).toString('hex') + '.msg';
  const target = path.join(dir, name);
  fs.writeFileSync(target + '.tmp', process.env.PAYLOAD);
  fs.renameSync(target + '.tmp', target);
`;

const CHILD_READS = `
  const fs = require('fs');
  const path = require('path');
  const dir = process.env.CHANNEL_DIR;
  const names = fs.readdirSync(dir).filter(n => n.endsWith('.msg')).sort();
  process.stdout.write(
    names.map(n => fs.readFileSync(path.join(dir, n), 'utf8')).join('\\n'),
  );
`;

function runChild(script, env) {
  return execFileSync(process.execPath, ['-e', script], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

/**
 * Take a subscriber off its timer so a test can drive scans by hand.
 *
 * The poll interval does not wait for the scan it started, so under load two
 * scans overlap and hand the same message to the subscriber twice. That is
 * tolerable in a fire-and-forget broadcast and intolerable in an assertion
 * about how many times a message was delivered.
 *
 * @param {import('./file.js').default} broker
 * @returns {Object} The broker's only subscription
 */
function takeOverScanning(broker) {
  broker.stopPolling();
  const [subscription] = broker.subscriptions;
  return subscription;
}

/** Wait until `check()` is true, or fail the assertion it encodes. */
async function until(check, timeout = 2000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (check()) return;

    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

describe('FileBroker', () => {
  let dataDir;
  const open = [];

  function makeBroker(options = {}) {
    // A separate instance on the same directory stands in for another
    // process on the same host — which is the whole point of this adapter.
    const broker = new FileBroker({
      dataDir,
      pollInterval: POLL,
      env: {},
      ...options,
    });
    open.push(broker);
    return broker;
  }

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xnapify-broker-'));
  });

  afterEach(async () => {
    await Promise.all(open.splice(0).map(broker => broker.cleanup()));
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it('delivers a message to a subscriber in another process', async () => {
    const publisher = makeBroker();
    const subscriber = makeBroker();

    const received = [];
    await subscriber.subscribe('ws:events', payload => received.push(payload));
    await publisher.publish('ws:events', 'hello');

    await until(() => received.length > 0);
    expect(received).toEqual(['hello']);
  });

  it('delivers to every subscriber, not just the first to claim it', async () => {
    // Broadcast, unlike the queue engine's file adapter where exactly one
    // worker claims each job.
    const publisher = makeBroker();
    const a = makeBroker();
    const b = makeBroker();

    const onA = [];
    const onB = [];
    await a.subscribe('ws:events', payload => onA.push(payload));
    await b.subscribe('ws:events', payload => onB.push(payload));
    await publisher.publish('ws:events', 'broadcast');

    await until(() => onA.length > 0 && onB.length > 0);
    expect(onA).toEqual(['broadcast']);
    expect(onB).toEqual(['broadcast']);
  });

  it('re-reads a message whose first read failed transiently', async () => {
    // An EMFILE from a momentarily exhausted fd table, or an EIO, is over
    // within a tick and leaves the file on disk and perfectly readable. The
    // message must stay eligible for the next scan rather than being recorded
    // as delivered on the strength of a filename alone.
    const publisher = makeBroker({ retentionMs: 5000 });
    const subscriber = makeBroker({ retentionMs: 5000 });

    const received = [];
    await subscriber.subscribe('ws:events', payload => received.push(payload));
    const subscription = takeOverScanning(subscriber);

    const { readFile } = fs;
    let injected = 0;
    const spy = jest
      .spyOn(fs, 'readFile')
      .mockImplementation((file, ...rest) => {
        if (typeof file === 'string' && file.endsWith('.msg') && !injected) {
          injected += 1;
          const error = new Error('I/O error');
          error.code = 'EIO';
          return Promise.reject(error);
        }
        return readFile(file, ...rest);
      });

    await publisher.publish('ws:events', 'important');
    await subscriber.deliver(subscription);
    expect(injected).toBe(1);
    expect(received).toEqual([]);

    await subscriber.deliver(subscription);
    spy.mockRestore();

    expect(received).toEqual(['important']);
  });

  it('stops retrying a message that never becomes readable', async () => {
    // Retrying is what saves the transient case, but EACCES — a publisher
    // running under another uid with a restrictive umask — never clears, and
    // an unbounded retry would re-log it on every one of the several hundred
    // polls in a retention window.
    const publisher = makeBroker({ retentionMs: 5000 });
    const subscriber = makeBroker({ retentionMs: 5000 });

    const received = [];
    await subscriber.subscribe('ws:events', payload => received.push(payload));
    const subscription = takeOverScanning(subscriber);

    let attempts = 0;
    const spy = jest.spyOn(fs, 'readFile').mockImplementation(file => {
      if (typeof file === 'string' && file.endsWith('.msg')) attempts += 1;
      const error = new Error('permission denied');
      error.code = 'EACCES';
      return Promise.reject(error);
    });
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});

    await publisher.publish('ws:events', 'unreadable');
    for (let scan = 0; scan < 6; scan += 1) {
      await subscriber.deliver(subscription);
    }
    const logged = errors.mock.calls.length;
    spy.mockRestore();
    errors.mockRestore();

    expect(received).toEqual([]);
    expect(attempts).toBe(3);
    expect(logged).toBe(1);
  });

  it('does not replay messages published before the subscription', async () => {
    // Matches Redis pub/sub. Replaying would let a restarted worker re-apply
    // an old disconnect event against sessions that are live again.
    //
    // Subscribing immediately after publishing is the case worth pinning:
    // filenames carry millisecond timestamps, so a cutoff based on the
    // subscribe time alone cannot separate the two when they land in the
    // same millisecond. The subscription records what was already on disk.
    const publisher = makeBroker();
    await publisher.publish('ws:events', 'before');

    const subscriber = makeBroker();
    const received = [];
    await subscriber.subscribe('ws:events', payload => received.push(payload));
    await publisher.publish('ws:events', 'after');

    await until(() => received.length > 0);
    await new Promise(resolve => setTimeout(resolve, POLL * 3));
    expect(received).toEqual(['after']);
  });

  it('delivers a message whose write straddled the subscription', async () => {
    // A publisher stamps the filename when it begins writing and only renames
    // the finished file into place afterwards. A subscription starting inside
    // that gap finds nothing on disk to seed into `seen`, and the name that
    // lands a moment later predates `startedAt` — so a cutoff on the filename
    // timestamp discarded a message genuinely published to a live subscriber,
    // permanently and with nothing logged. `seen` is what enforces no-replay;
    // the timestamp cutoff only has to exclude history, not in-flight writes.
    const publisher = makeBroker();
    const subscriber = makeBroker();

    await publisher.publish('ws:events', 'straddled');
    const channelDir = publisher.dirFor('ws:events');
    const [name] = (await fs.readdir(channelDir)).filter(entry =>
      entry.endsWith('.msg'),
    );

    // Hold the finished file back, exactly as an unfinished rename would.
    const held = path.join(dataDir, name);
    await fs.rename(path.join(channelDir, name), held);
    await new Promise(resolve => setTimeout(resolve, 20));

    const received = [];
    await subscriber.subscribe('ws:events', payload => received.push(payload));

    // The publisher's rename finally lands, after the subscription seeded.
    await fs.rename(held, path.join(channelDir, name));

    await until(() => received.length > 0);
    expect(received).toEqual(['straddled']);
  });

  it('keeps channels isolated', async () => {
    const publisher = makeBroker();
    const subscriber = makeBroker();

    const received = [];
    await subscriber.subscribe('orders', payload => received.push(payload));
    await publisher.publish('shipments', 'noise');
    await publisher.publish('orders', 'signal');

    await until(() => received.length > 0);
    expect(received).toEqual(['signal']);
  });

  it('stops delivering once unsubscribed, and stops polling with no subscribers', async () => {
    const publisher = makeBroker();
    const subscriber = makeBroker();

    const received = [];
    const unsubscribe = await subscriber.subscribe('ws:events', payload =>
      received.push(payload),
    );
    await publisher.publish('ws:events', 'first');
    await until(() => received.length > 0);

    await unsubscribe();
    expect(subscriber.timer).toBeNull();

    await publisher.publish('ws:events', 'second');
    await new Promise(resolve => setTimeout(resolve, POLL * 4));
    expect(received).toEqual(['first']);
  });

  it('sweeps messages past the retention window', async () => {
    const broker = makeBroker({ retentionMs: 30 });
    const dir = broker.dirFor('ws:events');

    await broker.publish('ws:events', 'transient');
    expect(
      (await fs.readdir(dir)).filter(n => n.endsWith('.msg')),
    ).toHaveLength(1);

    await new Promise(resolve => setTimeout(resolve, 60));
    await broker.sweep(dir);

    expect(
      (await fs.readdir(dir)).filter(n => n.endsWith('.msg')),
    ).toHaveLength(0);
  });

  it('does not redeliver when two delivery passes overlap', async () => {
    // poll() runs on a timer and its result is not awaited, so passes overlap.
    // Pruning `seen` against the listing the *older* pass captured deletes the
    // entry the newer pass just recorded, and the message goes out twice.
    const broker = makeBroker({ retentionMs: 60_000 });
    const received = [];
    await broker.subscribe('overlap', payload => received.push(payload));

    await broker.publish('overlap', 'first');
    const subscription = takeOverScanning(broker);

    // Two passes in flight at once over the same directory.
    await Promise.all([
      broker.deliver(subscription),
      broker.deliver(subscription),
    ]);
    await broker.publish('overlap', 'second');
    await Promise.all([
      broker.deliver(subscription),
      broker.deliver(subscription),
    ]);

    expect(received).toEqual(['first', 'second']);
  });

  it('does not redeliver a message the sweep could not remove', async () => {
    // A spool whose permissions changed, or a sticky-bit directory shared
    // across uids, keeps failing to unlink. Expiring the delivery record on a
    // timer would then put a file that is still on disk back through the
    // undelivered filter — a disconnect event re-applied on every poll, five
    // times a second, for as long as the process lives.
    const publisher = makeBroker({ retentionMs: 40 });
    const subscriber = makeBroker({ retentionMs: 40 });

    const received = [];
    await subscriber.subscribe('ws:events', payload => received.push(payload));
    const subscription = takeOverScanning(subscriber);

    const spy = jest.spyOn(fs, 'rm').mockImplementation(() => {
      const error = new Error('operation not permitted');
      error.code = 'EPERM';
      return Promise.reject(error);
    });
    const warnings = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await publisher.publish('ws:events', 'disconnectUser');
    await subscriber.deliver(subscription);
    // Past twice the retention window, where a record kept on a timer expires.
    await new Promise(resolve => setTimeout(resolve, 100));
    await subscriber.deliver(subscription);
    await subscriber.deliver(subscription);
    spy.mockRestore();

    expect(received).toEqual(['disconnectUser']);
    // The unlink failure is the only thing that names the actual cause, so it
    // has to reach the log rather than being discarded.
    expect(warnings.mock.calls.flat().join(' ')).toMatch(/could not sweep/);
    warnings.mockRestore();
  });

  it('bounds how many unlinks one sweep has in flight', async () => {
    const broker = makeBroker({ retentionMs: 30 });
    const dir = broker.dirFor('ws:events');
    await fs.mkdir(dir, { recursive: true });

    // Filenames carry their own publish time, so a backlog can be written
    // already expired instead of waiting out a retention window.
    const stale = String(Date.now() - 10_000).padStart(13, '0');
    const backlog = Array.from(
      { length: 200 },
      (_, index) => `${stale}-${String(index).padStart(6, '0')}-1-aaaaaa.msg`,
    );
    await Promise.all(
      backlog.map(name => fs.writeFile(path.join(dir, name), 'stale')),
    );

    const { rm } = fs;
    let inFlight = 0;
    let peak = 0;
    const spy = jest.spyOn(fs, 'rm').mockImplementation(async (...args) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      try {
        return await rm(...args);
      } finally {
        inFlight -= 1;
      }
    });

    await broker.sweep(dir);
    spy.mockRestore();

    expect(await fs.readdir(dir)).toHaveLength(0);
    expect(peak).toBeLessThanOrEqual(DEFAULT_CONCURRENCY);
  });

  it('leaves no readable partial message behind', async () => {
    // Publish writes aside and renames in, so a scan can only ever see a
    // complete file — never a half-written one under its final name.
    const broker = makeBroker();
    const dir = broker.dirFor('ws:events');
    await broker.publish('ws:events', 'complete');

    const names = await fs.readdir(dir);
    expect(names.some(name => name.endsWith('.tmp'))).toBe(false);
    for (const name of names.filter(n => n.endsWith('.msg'))) {
      expect(await fs.readFile(path.join(dir, name), 'utf8')).toBe('complete');
    }
  });

  it('reports pub/sub without a KV client, and refuses to escape its data dir', () => {
    const broker = makeBroker();

    expect(broker.isConfigured()).toBe(true);
    expect(broker.getClient()).toBeNull();
    expect(typeof broker.onReconnect()).toBe('function');
    expect(typeof broker.onDisconnect()).toBe('function');

    // Channel names are hashed into a single directory segment, so a name
    // full of separators cannot climb out of the data directory.
    expect(broker.dirFor('../../etc/passwd').startsWith(dataDir)).toBe(true);
  });

  it('keeps two deployments sharing a data directory apart', async () => {
    // The default data directory is host-level, so two deployments that both
    // leave XNAPIFY_BROKER_DATA_DIR unset land on the same path. Without
    // namespacing, staging's disconnect events would reach production — and
    // cross-talk is indistinguishable from ordinary traffic, so nothing
    // would report it.
    const staging = makeBroker({ env: { XNAPIFY_REDIS_PREFIX: 'staging' } });
    const production = makeBroker({ env: { XNAPIFY_REDIS_PREFIX: 'prod' } });

    expect(staging.channel('ws:events')).toBe('staging:ws:events');
    expect(production.channel('ws:events')).toBe('prod:ws:events');

    const onProduction = [];
    await production.subscribe(production.channel('ws:events'), payload =>
      onProduction.push(payload),
    );
    await staging.publish(staging.channel('ws:events'), 'staging-only');

    await new Promise(resolve => setTimeout(resolve, POLL * 4));
    expect(onProduction).toEqual([]);
  });

  it('delivers a message written by a separate OS process', async () => {
    const subscriber = makeBroker();
    const channel = subscriber.channel('ws:events');
    const received = [];
    await subscriber.subscribe(channel, payload => received.push(payload));

    runChild(CHILD_PUBLISHES, {
      CHANNEL_DIR: subscriber.dirFor(channel),
      PAYLOAD: 'from-another-process',
    });

    await until(() => received.length > 0);
    expect(received).toEqual(['from-another-process']);
  });

  it('publishes messages a separate OS process can read', async () => {
    const publisher = makeBroker();
    const channel = publisher.channel('ws:events');
    await publisher.publish(channel, 'to-another-process');

    const seenByChild = runChild(CHILD_READS, {
      CHANNEL_DIR: publisher.dirFor(channel),
    });

    expect(seenByChild.trim()).toBe('to-another-process');
  });

  it('refuses a non-string payload instead of writing it as garbage', async () => {
    // `String({})` is "[object Object]"; the reader's JSON.parse would fail
    // and drop the message with no error raised anywhere.
    const broker = makeBroker();
    await expect(broker.publish('ws:events', { id: 1 })).rejects.toThrow(
      TypeError,
    );
  });

  it('is selectable by type but never auto-detected', () => {
    expect(createFactory({ type: 'file', dataDir, env: {} })).toBeInstanceOf(
      FileBroker,
    );
    expect(
      createFactory({ dataDir, env: { XNAPIFY_BROKER_TYPE: 'file' } }),
    ).toBeInstanceOf(FileBroker);
    // A data directory alone says nothing about whether other processes on
    // this host should hear these messages, so it stays opt-in.
    expect(createFactory({ dataDir, env: {} })).not.toBeInstanceOf(FileBroker);
  });

  describe('teardown during an in-flight delivery pass', () => {
    it('stops handing messages to a subscriber unsubscribed mid-pass', async () => {
      // A pass awaits a readdir and one readFile per message. Both teardown
      // paths are synchronous mutations the running pass never re-reads, so a
      // scan already in flight kept calling a handler whose owner had gone.
      const publisher = makeBroker();
      const subscriber = makeBroker();
      const received = [];

      let unsubscribe;
      unsubscribe = await subscriber.subscribe('chan', payload => {
        received.push(payload);
        // Detach from inside the first delivery, while the same pass still
        // holds the subscription object and has more messages queued.
        if (received.length === 1) unsubscribe();
      });
      const subscription = takeOverScanning(subscriber);

      await publisher.publish('chan', 'one');
      await publisher.publish('chan', 'two');
      await publisher.publish('chan', 'three');

      await subscriber.deliver(subscription);

      expect(received).toEqual(['one']);
    });

    it('stops handing messages to a subscriber whose broker closed mid-pass', async () => {
      const publisher = makeBroker();
      const subscriber = makeBroker();
      const received = [];

      await subscriber.subscribe('chan', payload => {
        received.push(payload);
        if (received.length === 1) subscriber.cleanup();
      });
      const subscription = takeOverScanning(subscriber);

      await publisher.publish('chan', 'one');
      await publisher.publish('chan', 'two');
      await publisher.publish('chan', 'three');

      await subscriber.deliver(subscription);

      expect(received).toEqual(['one']);
    });
  });
});
