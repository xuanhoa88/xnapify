/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * File-backed broker adapter — cross-process fan-out on ONE host.
 *
 * Fills the gap between `memory` (one process) and `redis` (any number of
 * hosts): several processes on the same machine sharing a data directory
 * deliver each other's messages without a broker daemon.
 *
 * ## Semantics: fire-and-forget broadcast, no replay
 *
 * Deliberately the same contract as Redis pub/sub, because the WebSocket
 * fan-out that consumes it is written against exactly that:
 *
 * - Every live subscriber receives every message, including a subscriber in
 *   the publishing process (the WS layer de-duplicates by `origin`).
 * - A message published while nobody was subscribed is gone. Subscribing
 *   does NOT replay history — a fresh subscriber ignores everything already
 *   on disk, so a restarted worker cannot re-apply an old disconnect event.
 * - Messages survive only `retentionMs` (default 30s) on disk. That is a
 *   sweep window, not a delivery guarantee: a process paused longer than the
 *   window can miss messages. It logs when it notices itself falling behind
 *   (see `warnIfBehind`) rather than losing them quietly.
 *
 * ## The single-host constraint is load-bearing
 *
 * Publishing is a write to a temp file plus `rename`, and delivery is a
 * directory scan. Both rest on the same two filesystem properties the queue
 * engine's file adapter documents: `rename()` is atomic, and timestamps are
 * trustworthy. Neither holds on NFS, SMB/CIFS, or a volume mounted
 * read-write across several hosts. Use the `redis` adapter there.
 *
 * ## This does NOT make clustering safe without Redis
 *
 * It carries pub/sub only. `getClient()` is `null`, so the shared cache,
 * rate-limit counters, session revocation store and the cron leader lock all
 * stay per-process — which is why `shared/config/env.js` still refuses
 * `XNAPIFY_CLUSTER_WORKERS > 1` without `XNAPIFY_REDIS_URL`.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { mapLimit, writeFileAtomic } from '@shared/utils/atomic/index.js';
import { getDataDir } from '@shared/utils/env.js';

import { getDeploymentPrefix } from '../prefix.js';

/** How often each process scans for messages published by the others. */
const DEFAULT_POLL_INTERVAL = 200;

/** How long a delivered message stays on disk before the sweep removes it. */
const DEFAULT_RETENTION_MS = 30_000;

/** Timestamp width in a filename; 13 digits stays sortable until year 2286. */
const TS_WIDTH = 13;

/** How many polls an unreadable message is retried over before it is dropped. */
const MAX_READ_ATTEMPTS = 3;

/**
 * Ceiling on remembered message names per subscription. Only reachable when the
 * spool has stopped being swept, which is warned about separately.
 */
const MAX_SEEN_ENTRIES = 10_000;

/**
 * How far before `startedAt` a filename may be stamped and still be delivered.
 *
 * A publisher stamps the name when it begins writing and renames the finished
 * file into place afterwards. A subscription seeding inside that gap sees
 * neither the file — not on disk yet — nor a name it will accept, since the
 * stamp predates `startedAt`; the message was dropped permanently and silently.
 *
 * `seen` is what actually enforces no-replay: subscribe() records every name
 * already on disk, and pruneSeen only forgets names that have since been
 * deleted. So this cutoff never has to catch history that `seen` already holds
 * — it is a backstop for the one case that outlives `seen`, the MAX_SEEN_ENTRIES
 * overflow — and it can afford to admit a write that was genuinely in flight.
 */
const IN_FLIGHT_WRITE_MS = 5_000;

function log(message, level = 'info') {
  const prefix = '[Broker:file]';
  if (level === 'error') console.error(`${prefix} ❌ ${message}`);
  else if (level === 'warn') console.warn(`${prefix} ⚠️  ${message}`);
  else console.info(`${prefix} ✅ ${message}`);
}

/**
 * Map a channel name onto a directory name that is safe on every platform.
 *
 * Channel names carry `:` (`xnapify:ws:events`), which is legal on POSIX but
 * not on Windows, and two different channels must never collide — hence the
 * hash suffix rather than a lossy replacement alone.
 *
 * @param {string} channel
 * @returns {string}
 */
function channelDirName(channel) {
  const safe = String(channel)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(0, 64);
  const hash = crypto
    .createHash('sha1')
    .update(String(channel))
    .digest('hex')
    .slice(0, 8);
  return `${safe}.${hash}`;
}

/** @param {string} name @returns {number} Publish time encoded in a filename */
function timestampOf(name) {
  const ts = Number.parseInt(name.slice(0, TS_WIDTH), 10);
  return Number.isFinite(ts) ? ts : 0;
}

class FileBroker {
  /**
   * @param {Object} [options]
   * @param {string} [options.dataDir] - Base directory shared by the processes
   * @param {number} [options.pollInterval=200] - Scan period in ms
   * @param {number} [options.retentionMs=30000] - Age at which messages are swept
   * @param {NodeJS.ProcessEnv} [options.env=process.env]
   */
  constructor({ dataDir, pollInterval, retentionMs, env = process.env } = {}) {
    this.env = env;
    const configured = dataDir || env.XNAPIFY_BROKER_DATA_DIR;
    this.dataDir = configured ? path.resolve(configured) : getDataDir('broker');

    this.pollInterval = Math.max(
      10,
      Number(pollInterval) || DEFAULT_POLL_INTERVAL,
    );
    this.retentionMs = Math.max(
      this.pollInterval * 2,
      Number(retentionMs) || DEFAULT_RETENTION_MS,
    );

    /** @type {Set<Object>} Live subscriptions owned by this instance */
    this.subscriptions = new Set();
    this.timer = null;
    this.sequence = 0;
    this.lastSweep = 0;
    this.sweepWarnedAt = new Map();
    this.closed = false;
  }

  /** A shared directory is all this adapter needs to be usable. */
  isConfigured() {
    return true;
  }

  /** No KV/lock-capable client backs a directory of message files. */
  getClient() {
    return null;
  }

  /**
   * Namespace a channel for this deployment.
   *
   * The default data directory is host-level, so two deployments on one
   * machine that both leave `XNAPIFY_BROKER_DATA_DIR` unset resolve the same
   * path — and staging would deliver its `disconnectUser` events into
   * production. Cross-talk looks exactly like ordinary traffic, so nothing
   * would report it. Namespacing the channel is the same protection
   * `RedisBroker` applies for the same reason.
   *
   * @param {string} name
   * @returns {string}
   */
  channel(name) {
    return `${this.getKeyPrefix()}${name}`;
  }

  getKeyPrefix() {
    return getDeploymentPrefix(this.env);
  }

  /** A directory does not connect, so it cannot reconnect or drop out. */
  onReconnect() {
    return () => {};
  }

  onDisconnect() {
    return () => {};
  }

  /**
   * Absolute directory holding one channel's messages, guarded against a
   * channel name escaping the data directory.
   *
   * @param {string} channel
   * @returns {string}
   */
  dirFor(channel) {
    const dir = path.join(this.dataDir, channelDirName(channel));
    if (!path.resolve(dir).startsWith(path.resolve(this.dataDir))) {
      throw new Error(`FileBroker: path traversal detected in "${channel}"`);
    }
    return dir;
  }

  /**
   * @param {string} channel
   * @param {string} payload
   * @returns {Promise<void>}
   */
  async publish(channel, payload) {
    if (this.closed) throw new Error('FileBroker: adapter is closed');

    // The other adapters pass a non-string through to something that copes
    // with it; this one would write `[object Object]` to disk, the reader
    // would fail to `JSON.parse` it, and the message would vanish with no
    // error anywhere. Refuse it at the point the contract is broken.
    if (typeof payload !== 'string') {
      throw new TypeError(
        `FileBroker: payload must be a string, received ${typeof payload}`,
      );
    }

    const dir = this.dirFor(channel);
    await fs.mkdir(dir, { recursive: true });

    this.sequence += 1;
    const name =
      `${String(Date.now()).padStart(TS_WIDTH, '0')}-` +
      `${String(this.sequence).padStart(6, '0')}-` +
      `${process.pid}-${crypto.randomBytes(3).toString('hex')}.msg`;

    // Written aside and renamed in: a reader scanning the directory can only
    // ever observe a complete message, never a half-written one.
    const target = path.join(dir, name);
    // `durable: false` matches the semantics this stands in for: Redis pub/sub
    // drops anything no subscriber is listening for, so paying an fsync per
    // publish would buy a guarantee the interface does not offer. The temp file
    // and its cleanup still matter — those defend against a concurrent reader
    // and against orphans accumulating in the spool, which are per-message
    // events rather than per-outage ones.
    await writeFileAtomic(target, String(payload), {
      durable: false,
      ensureDir: false,
      preserveMode: false,
    });

    // A process that only publishes never polls, so it would never sweep;
    // do it here (throttled) so files cannot accumulate without a reader.
    if (Date.now() - this.lastSweep > this.retentionMs / 2) {
      await this.sweep(dir).catch(() => {});
    }
  }

  /**
   * @param {string} channel
   * @param {(payload: string) => void} onMessage
   * @returns {Promise<() => Promise<void>>} Unsubscribe function
   */
  async subscribe(channel, onMessage) {
    if (this.closed) throw new Error('FileBroker: adapter is closed');

    const dir = this.dirFor(channel);
    await fs.mkdir(dir, { recursive: true });

    const startedAt = Date.now();

    // No replay: everything already on disk predates this subscriber, the
    // way a fresh Redis SUBSCRIBE sees no history. Recorded as names rather
    // than trusting `startedAt` alone, because filenames carry millisecond
    // timestamps — a message published in the same millisecond as this call
    // would otherwise be indistinguishable from one published after it.
    const existing = new Map();
    for (const name of await this.readChannelDir(dir)) {
      if (name.endsWith('.msg')) existing.set(name, timestampOf(name));
    }

    const subscription = {
      channel,
      dir,
      onMessage,
      startedAt,
      seen: existing,
      readAttempts: new Map(),
      behindWarnedAt: 0,
    };
    this.subscriptions.add(subscription);
    this.startPolling();

    return async () => {
      this.subscriptions.delete(subscription);
      if (this.subscriptions.size === 0) this.stopPolling();
    };
  }

  startPolling() {
    if (this.timer || this.closed) return;
    this.timer = setInterval(() => {
      this.poll().catch(error => {
        log(`poll failed: ${error.message}`, 'error');
      });
    }, this.pollInterval);
    // Never hold the process open for a fan-out scan.
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stopPolling() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  /** One scan across every live subscription. */
  async poll() {
    for (const subscription of [...this.subscriptions]) {
      // A scan already in flight when cleanup() ran must not call a handler
      // after teardown.
      if (this.closed) return;
      // Deliberately sequential: a subscriber's handlers should observe
      // messages in publish order, not interleaved with the next scan.
      // Isolated per subscription, so one unreadable channel directory
      // cannot starve the others for the rest of the tick.
      try {
        await this.deliver(subscription);
      } catch (error) {
        log(
          `delivery failed on "${subscription.channel}": ${error.message}`,
          'error',
        );
      }
    }
  }

  /**
   * List a channel directory, treating "not created yet" as empty.
   * @param {string} dir
   * @returns {Promise<string[]>}
   */
  async readChannelDir(dir) {
    try {
      return await fs.readdir(dir);
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  /**
   * Deliver everything this subscription has not seen yet.
   * @param {Object} subscription
   */
  /**
   * Run one delivery pass for `subscription`, never two at once.
   *
   * `startPolling` drives `poll()` from a `setInterval` that does not await it,
   * so a pass slower than the poll interval — a large spool, a slow disk, a
   * subscriber whose handler blocks — is still running when the next tick
   * fires. Both passes would compute `fresh` from their own listing before
   * either had recorded anything in `seen`, and every message in flight would
   * reach the subscriber twice. Collapsing concurrent calls onto the in-flight
   * one restores the at-most-once delivery the `seen` set is meant to give.
   */
  async deliver(subscription) {
    if (subscription.delivering) return subscription.delivering;

    subscription.delivering = this.deliverOnce(subscription).finally(() => {
      subscription.delivering = null;
    });
    return subscription.delivering;
  }

  /** @private */
  async deliverOnce(subscription) {
    const names = await this.readChannelDir(subscription.dir);

    const fresh = names
      .filter(name => name.endsWith('.msg'))
      .filter(name => !subscription.seen.has(name))
      .filter(
        name =>
          timestampOf(name) >= subscription.startedAt - IN_FLIGHT_WRITE_MS,
      )
      .sort();

    if (fresh.length === 0) {
      // Prune here too: a subscription that started with files on disk seeded
      // them all into `seen`, and on a channel that then goes quiet those
      // entries would be held for the life of the process.
      await this.pruneSeen(subscription);
      await this.sweep(subscription.dir).catch(() => {});
      return;
    }

    this.warnIfBehind(subscription, fresh);

    for (const name of fresh) {
      // Re-checked every message, not once per pass. Between the poll()
      // guard and here sit a readdir and one readFile per message, and both
      // teardown paths — cleanup() and the unsubscribe closure — are
      // synchronous mutations that an in-flight pass holding a direct
      // subscription reference never notices. Without this, a scan already
      // running when the server began closing its sockets keeps handing
      // messages to a handler whose owner is gone.
      if (this.closed || !this.subscriptions.has(subscription)) return;

      let payload;
      try {
        payload = await fs.readFile(path.join(subscription.dir, name), 'utf8');
      } catch (error) {
        // ENOENT is another process's sweep landing between the readdir and
        // the read: the retention window elapsed, which is a drop this
        // subscriber already warned about if it was behind, and there is
        // nothing left on disk to retry.
        if (error.code !== 'ENOENT') {
          this.recordFailedRead(subscription, name, error);
        }
        continue;
      }
      // Recorded as delivered only once the bytes are in hand: an EMFILE from
      // a momentarily exhausted fd table, or an EIO, leaves the file on disk
      // and readable a tick later, and marking it ahead of the read would
      // filter it out of every later poll instead.
      subscription.readAttempts.delete(name);
      subscription.seen.set(name, timestampOf(name));
      try {
        subscription.onMessage(payload);
      } catch (error) {
        log(
          `subscriber threw on ${subscription.channel}: ${error.message}`,
          'error',
        );
      }
    }

    await this.pruneSeen(subscription);
    await this.sweep(subscription.dir).catch(() => {});
  }

  /**
   * Count a read that failed for a reason other than the file being gone, and
   * give up on the message once it has had enough attempts.
   *
   * Leaving a failed name out of `seen` is what lets the next poll try again,
   * but not every unreadable file is transient — a publisher running under a
   * different uid with a restrictive umask makes EACCES permanent — and an
   * unbounded retry would re-log it on every one of the ~150 polls in a
   * retention window. A small allowance covers the transient fault and then
   * treats the message as delivered, logging once at the point it is dropped.
   *
   * @param {Object} subscription
   * @param {string} name
   * @param {Error} error
   */
  recordFailedRead(subscription, name, error) {
    const attempts = (subscription.readAttempts.get(name) || 0) + 1;
    if (attempts < MAX_READ_ATTEMPTS) {
      subscription.readAttempts.set(name, attempts);
      return;
    }
    subscription.readAttempts.delete(name);
    subscription.seen.set(name, timestampOf(name));
    log(
      `unreadable message ${name} after ${attempts} attempts: ${error.message}`,
      'error',
    );
  }

  /**
   * Say so when this process is scanning slower than messages arrive.
   *
   * Retention is a sweep window, not a delivery guarantee: a subscriber that
   * stalls past it loses messages to another process's sweep. Losing them
   * quietly is the failure worth refusing, so notice the backlog while it is
   * still deliverable and log it.
   *
   * @param {Object} subscription
   * @param {string[]} fresh - Undelivered filenames, sorted oldest first
   */
  warnIfBehind(subscription, fresh) {
    const age = Date.now() - timestampOf(fresh[0]);
    if (age <= this.retentionMs) return;
    // One warning per window, so a sustained backlog does not flood the log.
    if (Date.now() - subscription.behindWarnedAt < this.retentionMs) return;
    subscription.behindWarnedAt = Date.now();
    log(
      `fan-out on "${subscription.channel}" is ${age}ms behind, past the ` +
        `${this.retentionMs}ms retention window — messages may have been ` +
        'swept before this process read them',
      'warn',
    );
  }

  /**
   * Forget filenames that are no longer in the channel directory.
   *
   * Age is the wrong discriminator here, because it assumes the sweep
   * succeeded. An `rm` that keeps failing — a spool whose permissions changed,
   * a sticky-bit directory shared across uids — leaves the file on disk while
   * its `seen` entry expires anyway, and `deliver`'s filter then reports the
   * same message as undelivered on every poll: a disconnect event re-applied
   * five times a second, forever. The listing `deliver` already holds says
   * exactly which names are really gone, and costs nothing extra to consult.
   *
   * @param {Object} subscription
   * @param {string[]} names - What this poll's scan of the directory found
   */
  /**
   * Forget names whose files are gone.
   *
   * Deliberately reads the directory here rather than reusing the listing
   * `deliver()` captured at its start. `poll()` runs on a timer and its result
   * is not awaited, so two `deliver()` passes overlap routinely; pruning
   * against the older pass's listing deletes entries the newer pass has just
   * recorded, and the message is delivered a second time — the one thing
   * `seen` exists to prevent.
   *
   * Presence, not age, decides: a file the sweep could not remove is still on
   * disk and therefore still redeliverable, so its name has to be remembered
   * for exactly as long as it survives.
   * @private
   */
  async pruneSeen(subscription) {
    let present;
    try {
      present = new Set(await fs.readdir(subscription.dir));
    } catch {
      // Directory unreadable right now; keeping every name is the safe side of
      // this decision, since forgetting one redelivers its message.
      return;
    }

    for (const name of subscription.seen.keys()) {
      if (!present.has(name)) subscription.seen.delete(name);
    }
    for (const name of subscription.readAttempts.keys()) {
      if (!present.has(name)) subscription.readAttempts.delete(name);
    }

    // A spool that never empties would otherwise grow `seen` for the life of
    // the subscription. Past this bound the memory cost outweighs the duplicate
    // deliveries that dropping the oldest names can cause, and the operator is
    // told plainly which trade is being made.
    if (subscription.seen.size > MAX_SEEN_ENTRIES) {
      const excess = subscription.seen.size - MAX_SEEN_ENTRIES;
      const oldest = [...subscription.seen.entries()]
        .sort((a, b) => a[1] - b[1])
        .slice(0, excess);
      for (const [name] of oldest) subscription.seen.delete(name);
      log(
        `${subscription.channel}: tracking more than ${MAX_SEEN_ENTRIES} ` +
          `undeleted messages; forgetting the ${excess} oldest, which may ` +
          `redeliver them. The spool is not being swept.`,
        'warn',
      );
    }
  }

  /**
   * Remove messages past the retention window, and temp files a crashed
   * publisher left behind.
   *
   * @param {string} dir
   */
  async sweep(dir) {
    this.lastSweep = Date.now();
    const cutoff = Date.now() - this.retentionMs;

    let names;
    try {
      names = await fs.readdir(dir);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return;
    }

    const stale = names.filter(name => {
      if (timestampOf(name) >= cutoff) return false;
      return name.endsWith('.msg') || name.endsWith('.tmp');
    });

    // Bounded: a spool holding a full retention window of a busy channel is
    // thousands of entries, and handing every unlink to the libuv threadpool
    // at once queues the SSR process's own template and asset reads behind
    // housekeeping. `force` keeps the expected race — another process
    // sweeping the same file first — from counting as a failure.
    const results = await mapLimit(stale, name =>
      fs.rm(path.join(dir, name), { force: true }),
    );

    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) this.warnSweepFailed(dir, failed);
  }

  /**
   * Say so when a channel directory cannot be swept.
   *
   * A spool that will not empty is not merely wasted disk: a
   * subscriber that restarts has only its `startedAt` cutoff standing between
   * it and a
   * subscriber that restarts has only its `startedAt` cutoff standing between
   * it and a directory full of stale events. The unlink failure is the one
   * place that names the cause — a permissions change, a read-only remount —
   * so discarding it turns a fixable mistake into silence.
   *
   * @param {string} dir
   * @param {Array<{ reason: Error }>} failed
   */
  warnSweepFailed(dir, failed) {
    // One warning per window *per directory*. Throttling on a single shared
    // timestamp meant one persistently broken channel silenced the warning for
    // every other channel on the same broker, hiding the failure exactly where
    // it mattered.
    const lastWarned = this.sweepWarnedAt.get(dir) ?? 0;
    if (Date.now() - lastWarned < this.retentionMs) return;
    this.sweepWarnedAt.set(dir, Date.now());
    log(
      `could not sweep ${failed.length} expired file(s) from ${dir}: ` +
        `${failed[0].reason.message} — messages are outliving the ` +
        `${this.retentionMs}ms retention window`,
      'warn',
    );
  }

  /**
   * Stop scanning and drop this instance's subscriptions.
   *
   * The data directory is shared with the other processes, so nothing on
   * disk is removed here beyond what the retention sweep already handles.
   */
  async cleanup() {
    this.closed = true;
    this.stopPolling();
    this.subscriptions.clear();
  }
}

export default FileBroker;
