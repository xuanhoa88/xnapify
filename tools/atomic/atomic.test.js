/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Contract test for the build toolchain's trimmed atomic module.
 *
 * This module was cut down from the runtime's `shared/utils/atomic` to the
 * surface `tools/` actually imports. Two kinds of removal need a guard here,
 * because they fail in opposite ways:
 *
 *   - a removed *export* fails loudly on its own (ESM refuses the import), and
 *     the surface test below pins the list so a drift is a red test, not a
 *     silent re-growth;
 *   - a removed *option* — `durable`, `preserveMode`, `retries`, `maxBytes` —
 *     would fail silently, since passing an unknown option is legal JS. The
 *     behaviours those options used to select are now hardcoded, so each one
 *     is asserted directly instead.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import * as atomic from './index.js';
import {
  ensureDir,
  mapLimit,
  readFileSafeSync,
  readJsonSafeSync,
  resolveWithin,
  tempSuffix,
  withFileLock,
  writeFileAtomic,
  writeFileAtomicSync,
  writeJsonAtomicSync,
} from './index.js';

let workDir;

beforeEach(async () => {
  workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-tools-atomic-'));
});

afterEach(async () => {
  await fsp.rm(workDir, { recursive: true, force: true });
});

describe('public surface', () => {
  it('exports exactly what tools/ imports, and nothing it has stopped using', () => {
    // Pinned deliberately. The trim was driven by a scan of today's imports, so
    // the list has to fail loudly rather than quietly drift back towards a copy
    // of the runtime module. Adding a consumer means adding its symbol here.
    expect(Object.keys(atomic).sort()).toEqual([
      'ensureDir',
      'isMissingFsError',
      'mapLimit',
      'readFileSafeSync',
      'readJsonSafeSync',
      'resolveWithin',
      'tempSuffix',
      'withFileLock',
      'writeFileAtomic',
      'writeFileAtomicSync',
      'writeJsonAtomicSync',
    ]);
  });
});

describe('writeFileAtomic', () => {
  it('carries a 0600 file’s permissions across a replacement', async () => {
    // preboot rewrites .env with no `mode` of its own. Mode inheritance used to
    // be the `preserveMode` option and is now unconditional; if it regressed,
    // XNAPIFY_KEY would be republished world-readable.
    const target = path.join(workDir, '.env');
    await fsp.writeFile(target, 'XNAPIFY_KEY=old\n', { mode: 0o600 });
    await fsp.chmod(target, 0o600);

    await writeFileAtomic(target, 'XNAPIFY_KEY=new\n');

    expect((await fsp.stat(target)).mode & 0o777).toBe(0o600);
    await expect(fsp.readFile(target, 'utf8')).resolves.toBe(
      'XNAPIFY_KEY=new\n',
    );
  });

  it('honours an explicit mode for a file that does not exist yet', async () => {
    // jwt.js creates .env at 0600 on a fresh checkout, where there is no
    // existing file to inherit from.
    const target = path.join(workDir, 'fresh.env');

    await writeFileAtomic(target, 'secret', { mode: 0o600 });

    expect((await fsp.stat(target)).mode & 0o777).toBe(0o600);
  });

  it('leaves no temp file behind on success', async () => {
    const target = path.join(workDir, 'manifest.json');

    await writeFileAtomic(target, '{}');

    expect(await fsp.readdir(workDir)).toEqual(['manifest.json']);
  });

  it('leaves the previous file intact when the write fails', async () => {
    const target = path.join(workDir, 'keep.txt');
    await fsp.writeFile(target, 'original');

    // A circular value cannot be serialised, so writeJsonAtomicSync throws
    // before it publishes anything.
    const circular = {};
    circular.self = circular;
    expect(() => writeJsonAtomicSync(target, circular)).toThrow();

    expect(fs.readFileSync(target, 'utf8')).toBe('original');
    expect(await fsp.readdir(workDir)).toEqual(['keep.txt']);
  });
});

describe('writeFileAtomicSync', () => {
  it('inherits 0600 the same way the async form does', () => {
    const target = path.join(workDir, '.env');
    fs.writeFileSync(target, 'A=1\n');
    fs.chmodSync(target, 0o600);

    writeFileAtomicSync(target, 'A=2\n');

    expect(fs.statSync(target).mode & 0o777).toBe(0o600);
    expect(fs.readFileSync(target, 'utf8')).toBe('A=2\n');
  });
});

describe('writeJsonAtomicSync', () => {
  it('round-trips through readJsonSafeSync with a trailing newline', () => {
    const target = path.join(workDir, 'stats.json');

    writeJsonAtomicSync(target, { a: 1 }, { spaces: 2 });

    expect(fs.readFileSync(target, 'utf8').endsWith('\n')).toBe(true);
    expect(readJsonSafeSync(target)).toEqual({ a: 1 });
  });
});

describe('readFileSafeSync', () => {
  it('returns the fallback for a missing file', () => {
    expect(
      readFileSafeSync(path.join(workDir, 'nope'), { fallback: null }),
    ).toBeNull();
  });
});

describe('readJsonSafeSync', () => {
  it('returns the fallback when the file is absent', () => {
    expect(
      readJsonSafeSync(path.join(workDir, 'absent.json'), { fallback: {} }),
    ).toEqual({});
  });

  it('throws on a truncated file rather than reporting it as missing', () => {
    // An atomic write never publishes a zero-length file, so an empty one means
    // something truncated it. Reporting that as "not written yet" would let the
    // build silently regenerate from an empty manifest.
    const target = path.join(workDir, 'torn.json');
    fs.writeFileSync(target, '');

    expect(() => readJsonSafeSync(target, { fallback: {} })).toThrow(
      /not valid JSON/,
    );
  });

  it('treats a file that parses but fails validate() as corrupt', () => {
    const target = path.join(workDir, 'wrong-shape.json');
    fs.writeFileSync(target, 'null');

    expect(() =>
      readJsonSafeSync(target, {
        fallback: {},
        validate: value => value !== null && typeof value === 'object',
      }),
    ).toThrow(/failed validation/);
  });
});

describe('resolveWithin', () => {
  it('permits a name inside the base and refuses one that escapes', () => {
    expect(resolveWithin(workDir, 'data')).toBe(path.join(workDir, 'data'));
    expect(() => resolveWithin(workDir, '../../etc/passwd')).toThrow(
      /escapes its base directory/,
    );
  });
});

describe('tempSuffix', () => {
  it('never repeats within a process', () => {
    const seen = new Set(Array.from({ length: 500 }, () => tempSuffix()));
    expect(seen.size).toBe(500);
  });
});

describe('ensureDir', () => {
  it('is idempotent for parallel build tasks', async () => {
    const nested = path.join(workDir, 'build', 'extensions');
    await Promise.all([
      ensureDir(nested),
      ensureDir(nested),
      ensureDir(nested),
    ]);
    expect(fs.statSync(nested).isDirectory()).toBe(true);
  });

  it('names the path when a file sits where the directory should go', async () => {
    const clash = path.join(workDir, 'clash');
    await fsp.writeFile(clash, 'x');
    await expect(ensureDir(clash)).rejects.toThrow(/a file already exists/);
  });
});

describe('mapLimit', () => {
  it('settles every task and returns failures as values', async () => {
    const results = await mapLimit([1, 2, 3], async n => {
      if (n === 2) throw new Error('boom');
      return n * 10;
    });

    expect(results.map(r => r.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
    ]);
    expect(results[0].value).toBe(10);
    expect(results[2].value).toBe(30);
  });
});

describe('withFileLock', () => {
  it('serialises two holders of the same lock', async () => {
    // The race this guards is real and documented in tools/utils/jwt.js: setup
    // and preboot both rewrite .env from a whole-file snapshot, so interleaving
    // them reverts a freshly minted XNAPIFY_KEY.
    const lockPath = path.join(workDir, '.env.lock');
    const order = [];

    const critical = async label => {
      order.push(`${label}:enter`);
      await new Promise(resolve => setTimeout(resolve, 20));
      order.push(`${label}:exit`);
    };

    await Promise.all([
      withFileLock(lockPath, () => critical('a'), { timeoutMs: 5_000 }),
      withFileLock(lockPath, () => critical('b'), { timeoutMs: 5_000 }),
    ]);

    // Whoever wins, neither section may open before the other has closed.
    expect(order).toHaveLength(4);
    expect(order[1]).toBe(`${order[0].split(':')[0]}:exit`);
    expect(order[3]).toBe(`${order[2].split(':')[0]}:exit`);
  });

  it('releases the lock file when the critical section throws', async () => {
    const lockPath = path.join(workDir, 'boom.lock');

    await expect(
      withFileLock(lockPath, async () => {
        throw new Error('inner failure');
      }),
    ).rejects.toThrow('inner failure');

    expect(fs.existsSync(lockPath)).toBe(false);
  });
});

describe('withFileLock', () => {
  it('times out instead of spinning when the lock path cannot be stat()ed', async () => {
    // A dangling symlink puts the retry loop in the one state it had no exit
    // from: open(O_CREAT|O_EXCL) refuses to follow a symlink and returns
    // EEXIST, while stat() follows it to a target that is not there and
    // returns ENOENT. The retry read that ENOENT as "the holder just released
    // it" and continued without sleeping or consulting the deadline — but the
    // condition is permanent, not transient, so the loop pinned a core and
    // timeoutMs was never enforced.
    //
    // This matters more here than in the runtime copy: tools/utils/jwt.js
    // takes this lock on `${envPath}.lock` from the dev and build tasks, so a
    // leftover `.env.lock` symlink wedges `npm run dev` at boot forever
    // instead of failing after its declared timeout.
    const lockPath = path.join(workDir, '.env.lock');
    await fsp.symlink(path.join(workDir, 'no-such-target'), lockPath);

    let ran = false;
    await expect(
      withFileLock(
        lockPath,
        async () => {
          ran = true;
        },
        { timeoutMs: 150, retryMs: 10 },
      ),
    ).rejects.toThrow(/Timed out/);
    expect(ran).toBe(false);
  });
});
