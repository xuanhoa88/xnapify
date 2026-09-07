/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { LockLostError, LockTimeoutError, wrapFsError } from './errors.js';
import { ensureDir, tempSuffix } from './write.js';

/** A lock not refreshed within this window is assumed abandoned. */
const DEFAULT_STALE_MS = 30_000;
/** How long `acquire` waits before giving up. */
const DEFAULT_TIMEOUT_MS = 10_000;
/** Base delay between acquisition attempts, jittered. */
const DEFAULT_RETRY_MS = 50;
/** Floor for the heartbeat, so a tiny `staleMs` cannot spin the event loop. */
const MIN_HEARTBEAT_MS = 50;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Identity of one specific acquisition.
 *
 * The random component matters as much as the pid: a container that restarts
 * can be handed the same pid, and without it a *new* process would look like
 * the legitimate owner of a lock the *old* process took, and would then release
 * a lock some third process is actually holding.
 */
function mintToken() {
  return JSON.stringify({
    id: crypto.randomBytes(8).toString('hex'),
    pid: process.pid,
    host: os.hostname(),
    at: new Date().toISOString(),
  });
}

/**
 * A held lock. Returned by {@link acquireFileLock}; prefer {@link withFileLock},
 * which cannot leak one.
 */
class LockHandle {
  constructor(lockPath, token, staleMs) {
    this.path = lockPath;
    this.token = token;
    this.staleMs = staleMs;
    /** Set once the lock is released or found to be stolen. */
    this.released = false;
    /** Set once release() has run its token-checked cleanup, so it runs once. */
    this.cleanedUp = false;
    /** Fires when the lock is lost, so a long critical section can bail out. */
    this.controller = new AbortController();
    this.timer = null;
    this.lostReason = null;
  }

  /** @returns {AbortSignal} Aborted the moment ownership is lost. */
  get signal() {
    return this.controller.signal;
  }

  /**
   * Refresh the lock's mtime so other processes keep seeing it as live, and
   * confirm it is still ours.
   *
   * Both halves are necessary. Without the refresh a critical section longer
   * than `staleMs` gets its lock stolen out from under it. Without the
   * ownership check the holder keeps working after a steal, which is exactly
   * the double-execution the lock existed to prevent.
   * @private
   */
  async beat() {
    try {
      const current = await fsp.readFile(this.path, 'utf8');
      if (current !== this.token) {
        this.lose('lock was stolen by another process');
        return;
      }
      const now = new Date();
      await fsp.utimes(this.path, now, now);
    } catch (error) {
      this.lose(
        error.code === 'ENOENT'
          ? 'lock file disappeared'
          : `lock heartbeat failed: ${error.message}`,
      );
    }
  }

  /** @private */
  lose(reason) {
    if (this.released) return;
    this.released = true;
    this.lostReason = reason;
    this.stopHeartbeat();
    this.controller.abort(
      new LockLostError(`${this.path}: ${reason}`, {
        path: this.path,
        operation: 'lock',
      }),
    );
  }

  /** @private */
  startHeartbeat(intervalMs) {
    // An async callback on a timer is a classic crash source: nothing awaits it,
    // so a rejection becomes an unhandled rejection and takes the process down.
    // beat() therefore never rejects — it converts every failure into loss.
    this.timer = setInterval(() => {
      void this.beat();
    }, intervalMs);
    // Never keep the event loop alive for a heartbeat; a held lock must not
    // stop the process from exiting.
    this.timer.unref?.();
  }

  /** @private */
  stopHeartbeat() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Release the lock, but only if it is still ours.
   *
   * Unlinking unconditionally would delete a lock a *different* process is
   * currently holding, silently letting two critical sections run at once —
   * strictly worse than never having locked at all.
   *
   * @returns {Promise<boolean>} Whether this call actually removed the lock.
   */
  async release() {
    this.stopHeartbeat();
    // Deliberately *not* gated on `released`. lose() sets that flag whenever
    // the heartbeat could not prove ownership, which includes failures that
    // never actually cost us the lock — an EACCES, an EMFILE under load. Those
    // used to skip the cleanup below and leave our own file sitting there
    // until it aged out of staleMs, locking every other process out of the
    // resource for the whole stale window over a failure that cost us nothing.
    // Running the cleanup on a lost handle is safe because the token check is
    // what makes it safe: a file holding someone else's token is never
    // unlinked, whatever this handle believes about itself.
    if (this.cleanedUp) return false;
    this.cleanedUp = true;
    this.released = true;
    try {
      const current = await fsp.readFile(this.path, 'utf8');
      if (current !== this.token) return false;
      await fsp.unlink(this.path);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw wrapFsError(error, 'releaseLock', this.path);
    }
  }
}

/**
 * Take an exclusive, cross-process lock on `lockPath`.
 *
 * Correctness rests on two filesystem primitives that are atomic on every
 * supported platform: `open(O_CREAT|O_EXCL)` — exactly one creator wins — and
 * `rename` — exactly one stealer wins. Nothing here depends on advisory
 * locking, which behaves differently on every network filesystem.
 *
 * A stale lock is stolen by renaming it aside first, so two processes that
 * simultaneously judge the same lock abandoned cannot both proceed: the loser's
 * rename fails with ENOENT and it goes back to waiting for the winner.
 *
 * @param {string} lockPath
 * @param {Object} [options]
 * @param {number} [options.staleMs=30000] - Age at which a lock is stealable.
 *   Must exceed the longest critical section, or a slow holder gets robbed.
 * @param {number} [options.timeoutMs=10000] - How long to wait before failing.
 * @param {number} [options.retryMs=50] - Base poll interval, jittered.
 * @param {number} [options.heartbeatMs] - Refresh interval. Defaults to, and is
 *   never allowed to exceed, a third of `staleMs`: the margin is what lets two
 *   consecutive missed beats still leave the lock live. A larger value passed
 *   here is clamped rather than honoured, because a heartbeat slower than the
 *   stale window makes losing the lock a certainty instead of an edge case.
 * @param {AbortSignal} [options.signal] - Give up waiting early.
 * @returns {Promise<LockHandle>}
 * @throws {LockTimeoutError}
 */
export async function acquireFileLock(lockPath, options = {}) {
  const {
    staleMs = DEFAULT_STALE_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryMs = DEFAULT_RETRY_MS,
    signal,
  } = options;

  // Clamped, not merely defaulted — see the heartbeatMs docs above.
  const heartbeatMs = Math.max(
    MIN_HEARTBEAT_MS,
    Math.min(options.heartbeatMs ?? Infinity, Math.floor(staleMs / 3)),
  );

  await ensureDir(path.dirname(lockPath));

  const deadline = Date.now() + timeoutMs;
  let lastAge = 0;
  let attempted = false;

  for (;;) {
    signal?.throwIfAborted();

    // Checked here, at the top, and not only beside the retry sleep at the
    // bottom. Several paths below `continue` early — a create that lost its
    // read-back, a stat that raced a release, a steal another waiter won — and
    // each of those skipped the bottom of the loop entirely, so `timeoutMs`
    // bound only the paths that happened to fall through. That is fine while
    // the condition is transient and fatal when it is not: a dangling symlink
    // at `lockPath` makes open(O_CREAT|O_EXCL) return EEXIST and stat() return
    // ENOENT *permanently*, and the loop spun on a core forever. tools/utils/
    // jwt.js takes this lock during `npm run dev`, so that spin wedged boot.
    if (attempted && Date.now() >= deadline) {
      throw new LockTimeoutError(
        `Timed out after ${timeoutMs}ms waiting for ${lockPath} ` +
          `(held by another process, last refreshed ${lastAge}ms ago)`,
        { code: 'ELOCKED', path: lockPath, operation: 'acquireFileLock' },
      );
    }
    attempted = true;

    const token = mintToken();
    try {
      await fsp.writeFile(lockPath, token, { flag: 'wx', mode: 0o600 });

      // Creating the file exclusively is not on its own proof of ownership.
      // A concurrent waiter may have decided, from a stat taken before this
      // create, that the lock was stale — and moved ours aside a moment later.
      // Reading the token back turns that into a lost race we retry, instead of
      // a handle we hand out for a lock we no longer hold.
      const written = await fsp.readFile(lockPath, 'utf8').catch(() => null);
      if (written !== token) {
        await sleep(retryMs * (0.5 + Math.random()));
        continue;
      }

      const handle = new LockHandle(lockPath, token, staleMs);
      handle.startHeartbeat(heartbeatMs);
      return handle;
    } catch (error) {
      if (error.code !== 'EEXIST')
        throw wrapFsError(error, 'acquireFileLock', lockPath);
    }

    // Held by someone. Abandoned, or genuinely busy?
    let age = 0;
    let judged = null;
    try {
      const stats = await fsp.stat(lockPath);
      age = Date.now() - stats.mtimeMs;
      lastAge = age;
      // Identity, not just age. `lockPath` is a name, and the file behind it
      // can be replaced between this stat and the steal below; the inode is
      // what tells us whether we later moved the *same* file we condemned.
      judged = `${stats.dev}:${stats.ino}`;
    } catch (error) {
      // Released between our create and our stat, or a path we cannot stat at
      // all. Back off before retrying: the common case is a genuine release
      // and costs one retry interval, while the pathological case — a create
      // that keeps failing EEXIST against something stat() keeps reporting as
      // ENOENT — would otherwise be a hot loop until the deadline.
      if (error.code === 'ENOENT') {
        await sleep(retryMs * (0.5 + Math.random()));
        continue;
      }
      throw wrapFsError(error, 'acquireFileLock', lockPath);
    }

    if (age > staleMs) {
      // Steal through a rename so that exactly one of several simultaneous
      // stealers wins; the losers see ENOENT and fall back to waiting.
      const aside = `${lockPath}${tempSuffix()}.stale`;
      try {
        await fsp.rename(lockPath, aside);
      } catch (error) {
        if (error.code !== 'ENOENT')
          throw wrapFsError(error, 'acquireFileLock', lockPath);
        // Someone else got there first; re-read the situation from scratch.
        continue;
      }

      // The stat above and this rename are two separate syscalls, so what we
      // just moved aside is not necessarily what we judged stale. Another
      // waiter can win the same steal and create its own fresh lock, and that
      // fresh lock is what sits at `lockPath` when our rename lands. Deleting
      // it would evict a live owner and leave two holders running at once —
      // precisely what this mechanism exists to prevent. So check what we
      // actually took, and put it back if it turned out to be alive.
      let taken = null;
      try {
        const stats = await fsp.stat(aside);
        taken = `${stats.dev}:${stats.ino}`;
      } catch {
        // Vanished from under us; nothing left to restore or remove.
      }

      if (taken !== null && taken !== judged) {
        // Not the file we condemned — another waiter won this same steal and
        // installed a live lock, which is what we just moved aside. Put it
        // back with link(), never rename(): rename() overwrites, so restoring
        // that way would obliterate a lock some *third* waiter legitimately
        // created in the gap we opened, trading one stolen lock for another.
        // link() fails with EEXIST instead — exactly the "restore only if the
        // slot is still empty" semantics this needs.
        await fsp.link(aside, lockPath).catch(() => {});
        await fsp.unlink(aside).catch(() => {});
        await sleep(retryMs * (0.5 + Math.random()));
        continue;
      }

      await fsp.unlink(aside).catch(() => {});
      continue;
    }

    // Jitter so a cluster of workers released at the same instant does not
    // retry in lockstep forever. The deadline is enforced at the top of the
    // loop, which every retry path reaches.
    await sleep(retryMs * (0.5 + Math.random()));
  }
}

/**
 * Run `fn` while holding an exclusive lock, releasing it whatever happens.
 *
 * `fn` receives an `AbortSignal` that fires if the lock is lost mid-flight.
 * Long critical sections should check it before any write; short ones can
 * ignore it, since losing a lock held for less than `staleMs` requires the
 * holder to have been paused for longer than that.
 *
 * @template T
 * @param {string} lockPath
 * @param {(signal: AbortSignal) => Promise<T>} fn
 * @param {Object} [options] - See {@link acquireFileLock}.
 * @param {boolean} [options.throwIfLost=true] - Fail the call when the lock was
 *   stolen during `fn`, rather than returning a result computed without it.
 * @returns {Promise<T>}
 */
export async function withFileLock(lockPath, fn, options = {}) {
  const { throwIfLost = true, ...acquireOptions } = options;
  const handle = await acquireFileLock(lockPath, acquireOptions);
  try {
    const result = await fn(handle.signal);
    if (throwIfLost && handle.lostReason) {
      throw new LockLostError(
        `${lockPath}: ${handle.lostReason}; the work done under it cannot be trusted`,
        { path: lockPath, operation: 'withFileLock' },
      );
    }
    return result;
  } finally {
    await handle.release().catch(() => {});
  }
}

export { LockHandle };
