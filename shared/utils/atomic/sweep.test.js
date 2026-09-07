/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { mapLimit } from './concurrency.js';
import { sweepTemps } from './sweep.js';

let dir;

const age = async (filePath, ms) => {
  const when = new Date(Date.now() - ms);
  await fsp.utimes(filePath, when, when);
};

beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-atomic-sweep-'));
});

afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true });
});

describe('sweepTemps', () => {
  it('removes abandoned temp artifacts and leaves real files alone', async () => {
    await fsp.writeFile(path.join(dir, 'data.json'), '{}');
    await fsp.writeFile(
      path.join(dir, 'data.json.abc-1-deadbeef.tmp'),
      'partial',
    );
    await fsp.writeFile(
      path.join(dir, 'x.lock.abc-2-deadbeef.tmp.stale'),
      'stolen',
    );
    await age(path.join(dir, 'data.json.abc-1-deadbeef.tmp'), 120_000);
    await age(path.join(dir, 'x.lock.abc-2-deadbeef.tmp.stale'), 120_000);

    const result = await sweepTemps(dir);

    expect(result.removed).toBe(2);
    expect(result.failed).toBe(0);
    expect(await fsp.readdir(dir)).toEqual(['data.json']);
  });

  it('leaves a user file alone that merely ends in .tmp', async () => {
    // The upload directory holds user-supplied names, and a user may legitimately
    // store `notes.tmp`. Matching on the suffix alone would delete it.
    const userFile = path.join(dir, 'notes.tmp');
    await fsp.writeFile(userFile, 'my notes');
    await age(userFile, 120_000);

    const result = await sweepTemps(dir);

    expect(result.removed).toBe(0);
    await expect(fsp.readFile(userFile, 'utf8')).resolves.toBe('my notes');
  });

  it('spares a temp file young enough to belong to a live writer', async () => {
    // Name alone cannot distinguish an in-flight write from an abandoned one,
    // so age is the only safe discriminator.
    await fsp.writeFile(
      path.join(dir, 'inflight.abc-1-deadbeef.tmp'),
      'writing',
    );

    const result = await sweepTemps(dir);

    expect(result.removed).toBe(0);
    expect(await fsp.readdir(dir)).toContain('inflight.abc-1-deadbeef.tmp');
  });

  it('descends only when asked, and only to maxDepth', async () => {
    await fsp.mkdir(path.join(dir, 'a', 'b'), { recursive: true });
    const nested = path.join(dir, 'a', 'b', 'deep.abc-1-deadbeef.tmp');
    await fsp.writeFile(nested, 'x');
    await age(nested, 120_000);

    expect((await sweepTemps(dir)).removed).toBe(0);
    expect(
      (await sweepTemps(dir, { recursive: true, maxDepth: 1 })).removed,
    ).toBe(0);
    expect((await sweepTemps(dir, { recursive: true })).removed).toBe(1);
  });

  it('never throws on a missing directory, because housekeeping must not fail callers', async () => {
    await expect(sweepTemps(path.join(dir, 'nope'))).resolves.toEqual(
      expect.objectContaining({ removed: 0, failed: 0 }),
    );
  });

  it('does not follow a symlink into an infinite descent', async () => {
    await fsp.mkdir(path.join(dir, 'real'));
    await fsp.symlink(dir, path.join(dir, 'real', 'loop'), 'dir');

    await expect(sweepTemps(dir, { recursive: true })).resolves.toBeDefined();
  });
});

describe('mapLimit', () => {
  it('caps how many operations are in flight at once', async () => {
    // Promise.all over a large directory opens one descriptor per entry and
    // hits EMFILE; the ceiling is the whole point of this helper.
    let inFlight = 0;
    let peak = 0;

    await mapLimit(
      Array.from({ length: 200 }, (_, i) => i),
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise(resolve => setTimeout(resolve, 1));
        inFlight -= 1;
      },
      8,
    );

    expect(peak).toBeLessThanOrEqual(8);
  });

  it('settles every task instead of abandoning the rest on the first rejection', async () => {
    const results = await mapLimit(
      [1, 2, 3, 4],
      async n => {
        if (n % 2 === 0) throw new Error(`odd one out: ${n}`);
        return n * 10;
      },
      2,
    );

    expect(results.map(r => r.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
      'rejected',
    ]);
    expect(results[0].value).toBe(10);
    expect(results[1].reason.message).toBe('odd one out: 2');
    expect(results[1].item).toBe(2);
  });

  it('preserves input order in the results', async () => {
    const results = await mapLimit([5, 1, 3], async n => {
      await new Promise(resolve => setTimeout(resolve, n));
      return n;
    });
    expect(results.map(r => r.value)).toEqual([5, 1, 3]);
  });
});
