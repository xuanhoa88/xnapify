/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { CorruptFileError } from './errors.js';
import { NO_CHANGE, updateJsonAtomic } from './update.js';

let dir;
let file;

beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-atomic-update-'));
  file = path.join(dir, 'registry.json');
});

afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true });
});

describe('updateJsonAtomic', () => {
  it('seeds the file from the fallback when it does not exist', async () => {
    const result = await updateJsonAtomic(file, current => ({
      ...current,
      a: 1,
    }));

    expect(result).toEqual({ a: 1 });
    expect(JSON.parse(await fsp.readFile(file, 'utf8'))).toEqual({ a: 1 });
  });

  it('loses no update when many writers race on the same file', async () => {
    // Atomic writes alone do not prevent this: both writers read {}, both write
    // a well-formed file, and one change vanishes. Only holding the lock across
    // the whole read-modify-write cycle stops it.
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        updateJsonAtomic(file, current => ({ ...current, [`k${i}`]: i }), {
          timeoutMs: 30_000,
          retryMs: 5,
        }),
      ),
    );

    const final = JSON.parse(await fsp.readFile(file, 'utf8'));
    expect(Object.keys(final)).toHaveLength(25);
    for (let i = 0; i < 25; i += 1) expect(final[`k${i}`]).toBe(i);
  });

  it('skips the write entirely when the mutator returns NO_CHANGE', async () => {
    await updateJsonAtomic(file, () => ({ a: 1 }));
    const before = await fsp.stat(file);

    await new Promise(resolve => setTimeout(resolve, 20));
    const result = await updateJsonAtomic(file, () => NO_CHANGE);

    expect(result).toEqual({ a: 1 });
    expect((await fsp.stat(file)).mtimeMs).toBe(before.mtimeMs);
  });

  it('leaves the file untouched when the mutator throws', async () => {
    await updateJsonAtomic(file, () => ({ a: 1 }));

    await expect(
      updateJsonAtomic(file, () => {
        throw new Error('mutator blew up');
      }),
    ).rejects.toThrow('mutator blew up');

    expect(JSON.parse(await fsp.readFile(file, 'utf8'))).toEqual({ a: 1 });
  });

  it('releases the lock after a failed mutation so the next caller proceeds', async () => {
    await updateJsonAtomic(file, () => ({ a: 1 })).catch(() => {});
    await expect(
      updateJsonAtomic(file, () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow();

    await expect(
      updateJsonAtomic(file, current => ({ ...current, b: 2 }), {
        timeoutMs: 500,
      }),
    ).resolves.toEqual({ a: 1, b: 2 });
  });

  it('refuses to overwrite a corrupt file by default', async () => {
    // Silently replacing an unreadable file discards whatever it held; the
    // caller has to opt into that.
    await fsp.writeFile(file, '{"a":1,"b');

    await expect(
      updateJsonAtomic(file, current => ({ ...current, c: 3 })),
    ).rejects.toThrow(CorruptFileError);
  });

  it('can rebuild from a corrupt file when told to', async () => {
    await fsp.writeFile(file, 'garbage');

    const result = await updateJsonAtomic(
      file,
      current => ({ ...current, c: 3 }),
      {
        onCorrupt: 'fallback',
        fallback: {},
      },
    );

    expect(result).toEqual({ c: 3 });
  });

  it('does not leave a lock file behind', async () => {
    await updateJsonAtomic(file, () => ({ a: 1 }));
    expect(await fsp.readdir(dir)).toEqual(['registry.json']);
  });
});
