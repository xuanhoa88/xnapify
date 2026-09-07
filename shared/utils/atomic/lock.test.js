/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { LockLostError, LockTimeoutError } from './errors.js';
import { acquireFileLock, withFileLock } from './lock.js';

let dir;
let lockPath;

beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-atomic-lock-'));
  lockPath = path.join(dir, 'resource.lock');
});

afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true });
});

/**
 * Poll until `check()` holds, instead of assuming a fixed sleep is long enough.
 *
 * These tests wait on interval-driven work: the heartbeat is clamped to
 * staleMs/3, so a fixed sleep silently encodes an assumption about how promptly
 * a timer fires. That holds on an idle machine and breaks when jest is running
 * several workers against a loaded box, where a 50ms interval slips well past
 * 150ms and the test fails for scheduling reasons rather than behaviour. The
 * deadline is deliberately generous: a condition that never arrives still fails,
 * and names itself when it does.
 */
const waitFor = async (check, label, timeout = 5000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`timed out after ${timeout}ms waiting for ${label}`);
};

describe('acquireFileLock', () => {
  it('creates the lock file readable only by its owner', async () => {
    const handle = await acquireFileLock(lockPath);
    try {
      expect((await fsp.stat(lockPath)).mode & 0o777).toBe(0o600);
    } finally {
      await handle.release();
    }
  });

  it('times out rather than waiting forever on a live lock', async () => {
    const held = await acquireFileLock(lockPath, { staleMs: 60_000 });
    try {
      await expect(
        acquireFileLock(lockPath, { timeoutMs: 150, staleMs: 60_000 }),
      ).rejects.toThrow(LockTimeoutError);
    } finally {
      await held.release();
    }
  });

  it('times out instead of spinning when the lock path cannot be stat()ed', async () => {
    // A dangling symlink puts the retry loop in the one state it had no exit
    // from: open(O_CREAT|O_EXCL) refuses a symlink with EEXIST, so the create
    // fails, while stat() follows it to a target that is not there and reports
    // ENOENT. That ENOENT reads as "the holder just released it, try again",
    // and the retry `continue`d without sleeping and without consulting the
    // deadline — so the condition, which is persistent rather than transient,
    // pinned a core at 100% and never honoured timeoutMs.
    await fsp.symlink(path.join(dir, 'no-such-target'), lockPath);

    await expect(
      acquireFileLock(lockPath, { timeoutMs: 150, retryMs: 10 }),
    ).rejects.toThrow(LockTimeoutError);
  });

  it('steals a lock whose owner stopped refreshing it', async () => {
    // Simulates a SIGKILLed holder: the file is there, nothing is updating it.
    await fsp.writeFile(lockPath, 'dead-owner-token');
    const old = new Date(Date.now() - 60_000);
    await fsp.utimes(lockPath, old, old);

    const handle = await acquireFileLock(lockPath, {
      staleMs: 1000,
      timeoutMs: 2000,
    });
    try {
      expect(await fsp.readFile(lockPath, 'utf8')).not.toBe('dead-owner-token');
    } finally {
      await handle.release();
    }
  });

  it('lets exactly one of several waiters claim the same stale lock', async () => {
    await fsp.writeFile(lockPath, 'dead-owner-token');
    const old = new Date(Date.now() - 60_000);
    await fsp.utimes(lockPath, old, old);

    const settled = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        acquireFileLock(lockPath, {
          staleMs: 1000,
          timeoutMs: 120,
          retryMs: 20,
        }),
      ),
    );

    const winners = settled.filter(r => r.status === 'fulfilled');
    expect(winners).toHaveLength(1);
    await winners[0].value.release();
  });

  it('does not evict a live lock that replaced the one it judged stale', async () => {
    // Regression, driven deterministically rather than by luck.
    //
    // The steal is stat-then-rename, two separate syscalls. Another waiter can
    // win the same steal in between, install its own live lock, and *that* is
    // what our rename moves aside. Deleting it left two callers each holding a
    // handle at once. The guard is identity: the inode we condemned has to be
    // the inode we actually moved.
    //
    // The interleaving is injected here because a probabilistic version of this
    // test passed even with the guard removed.
    await fsp.writeFile(lockPath, 'abandoned-token');
    const old = new Date(Date.now() - 60_000);
    await fsp.utimes(lockPath, old, old);

    const realRename = fsp.rename.bind(fsp);
    let injected = false;
    const renameSpy = jest
      .spyOn(fsp, 'rename')
      .mockImplementation(async (from, to) => {
        if (!injected && from === lockPath && String(to).endsWith('.stale')) {
          injected = true;
          // Stand in for the waiter that won this steal: the abandoned lock is
          // gone and a live one now occupies the path.
          await fsp.unlink(lockPath).catch(() => {});
          await fsp.writeFile(lockPath, 'live-owner-token', {
            flag: 'w',
            mode: 0o600,
          });
        }
        return realRename(from, to);
      });

    try {
      await expect(
        acquireFileLock(lockPath, {
          staleMs: 5000,
          timeoutMs: 400,
          retryMs: 20,
        }),
      ).rejects.toThrow(LockTimeoutError);

      expect(injected).toBe(true);
      // The live owner must still hold it, byte for byte.
      await expect(fsp.readFile(lockPath, 'utf8')).resolves.toBe(
        'live-owner-token',
      );
      // And no steal artifact may be left lying around.
      const leftovers = (await fsp.readdir(dir)).filter(n =>
        n.endsWith('.stale'),
      );
      expect(leftovers).toEqual([]);
    } finally {
      renameSpy.mockRestore();
    }
  }, 15_000);

  it('clamps a heartbeat that would be slower than the stale window', async () => {
    // Honouring this literally would guarantee the lock is stolen mid-section.
    const handle = await acquireFileLock(lockPath, {
      staleMs: 300,
      heartbeatMs: 10_000,
    });
    try {
      await new Promise(resolve => setTimeout(resolve, 400));
      expect(handle.released).toBe(false);
    } finally {
      await handle.release();
    }
  });

  it('keeps its own lock alive past staleMs by refreshing it', async () => {
    // Without the heartbeat, a critical section longer than staleMs gets its
    // lock stolen out from under it.
    const handle = await acquireFileLock(lockPath, { staleMs: 300 });
    try {
      await new Promise(resolve => setTimeout(resolve, 700));
      const age = Date.now() - (await fsp.stat(lockPath)).mtimeMs;
      expect(age).toBeLessThan(300);
      expect(handle.released).toBe(false);
    } finally {
      await handle.release();
    }
  });

  it('reports loss instead of crashing when its lock is deleted underneath it', async () => {
    const handle = await acquireFileLock(lockPath, { staleMs: 300 });
    await fsp.unlink(lockPath);
    await waitFor(
      () => handle.released,
      'the heartbeat to notice the deletion',
    );

    expect(handle.released).toBe(true);
    expect(handle.lostReason).toMatch(/disappeared/);
    expect(handle.signal.aborted).toBe(true);
  });
});

describe('release', () => {
  it('refuses to delete a lock that now belongs to someone else', async () => {
    // Unlinking unconditionally would free a lock another process is holding,
    // letting two critical sections run at once.
    const handle = await acquireFileLock(lockPath);
    await fsp.writeFile(lockPath, 'another-owners-token');

    expect(await handle.release()).toBe(false);
    expect(await fsp.readFile(lockPath, 'utf8')).toBe('another-owners-token');
  });

  it('still removes its own file after a transient heartbeat failure', async () => {
    // A heartbeat that cannot read the lock file is not evidence the lock was
    // stolen — EACCES here, EMFILE under load — and beat() is right to give up
    // ownership when it cannot prove it. But the file on disk is still ours,
    // and marking the handle released skipped release()'s token check, so the
    // file sat there until it aged out of staleMs. Nothing else could take the
    // resource for that whole window, from a failure that never actually cost
    // us the lock.
    // staleMs drives the heartbeat interval (it is clamped to staleMs/3), so
    // it has to be short enough that a beat actually lands inside this test.
    const handle = await acquireFileLock(lockPath, { staleMs: 300 });

    await fsp.chmod(lockPath, 0o000);
    await waitFor(() => handle.released, 'the heartbeat to fail on EACCES');
    expect(handle.released).toBe(true);
    expect(handle.lostReason).toMatch(/heartbeat failed/);

    // The condition clears; the token in the file is still ours.
    await fsp.chmod(lockPath, 0o600);

    expect(await handle.release()).toBe(true);
    await expect(fsp.stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('is idempotent', async () => {
    const handle = await acquireFileLock(lockPath);
    expect(await handle.release()).toBe(true);
    expect(await handle.release()).toBe(false);
  });
});

describe('withFileLock', () => {
  it('serialises concurrent callers', async () => {
    let inside = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 12 }, () =>
        withFileLock(
          lockPath,
          async () => {
            inside += 1;
            peak = Math.max(peak, inside);
            await new Promise(resolve => setTimeout(resolve, 15));
            inside -= 1;
          },
          { timeoutMs: 10_000, retryMs: 10 },
        ),
      ),
    );

    expect(peak).toBe(1);
  });

  it('releases the lock when the body throws', async () => {
    await expect(
      withFileLock(lockPath, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(fsp.access(lockPath)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('fails the call when the lock was stolen while the body ran', async () => {
    // The result was computed without real exclusivity, so returning it would
    // launder a race into a success.
    await expect(
      withFileLock(
        lockPath,
        async signal => {
          await fsp.unlink(lockPath);
          await waitFor(() => signal.aborted, 'the lock to be reported lost');
          return 'computed anyway';
        },
        { staleMs: 3000, heartbeatMs: 50 },
      ),
    ).rejects.toThrow(LockLostError);
  });

  it('exposes an AbortSignal a long body can check', async () => {
    const seen = await withFileLock(
      lockPath,
      async signal => {
        await fsp.unlink(lockPath);
        await waitFor(() => signal.aborted, 'the lock to be reported lost');
        return signal.aborted;
      },
      { staleMs: 3000, heartbeatMs: 50, throwIfLost: false },
    );

    expect(seen).toBe(true);
  });
});
