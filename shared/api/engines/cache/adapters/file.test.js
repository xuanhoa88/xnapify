/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import FileCache from './file.js';

let dir;
let cache;

beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-filecache-'));
  cache = new FileCache({ directory: dir });
  await cache.ready;
});

afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true });
});

describe('expiry deletes by identity, not by path', () => {
  it('does not destroy a fresher entry written while the expired one was being read', async () => {
    // Entries are published with rename, so the file behind a path can be
    // replaced between the read and the unlink. Deleting by path threw the new
    // entry away — a lost write that repeats for as long as the key stays hot.
    await cache.set('hot', 'stale-value', -1000); // already expired

    const filename = cache.getFilename('hot');
    const original = await cache.fileIdentity(filename);

    // Stand in for another writer publishing a fresh entry at the same path.
    await cache.writeFile(filename, {
      key: 'hot',
      value: 'fresh-value',
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });
    const replaced = await cache.fileIdentity(filename);
    expect(replaced).not.toBe(original);

    // The expired read must not remove the replacement.
    await cache.deleteFileIfUnchanged(filename, original);

    expect(await cache.get('hot')).toBe('fresh-value');
  });

  it('still removes the entry it actually read', async () => {
    await cache.set('gone', 'v', -1000);
    expect(await cache.get('gone')).toBeNull();
    expect(await cache.has('gone')).toBe(false);
  });
});

describe('eviction', () => {
  it('orders by mtime without reading file contents', async () => {
    // Sorting by the `createdAt` inside each entry meant a whole-file read and
    // JSON.parse per file — up to maxSize of them — before a single set()
    // could write a byte.
    const small = new FileCache({ directory: dir, maxSize: 4 });
    await small.ready;

    for (const key of ['a', 'b', 'c', 'd']) {
      await small.set(key, `value-${key}`);
      // Distinct mtimes; the filesystem's resolution is coarser than a loop.
      await new Promise(resolve => setTimeout(resolve, 12));
    }

    const readSpy = jest.spyOn(small, 'readFile');
    await small.evictIfNeeded();
    expect(readSpy).not.toHaveBeenCalled();
    readSpy.mockRestore();

    // 10% of 4, floored, is 0 — so at least one entry goes, and it is the oldest.
    expect(await small.get('a')).toBeNull();
    expect(await small.get('d')).toBe('value-d');
  });

  it('collapses concurrent sweeps into one', async () => {
    const small = new FileCache({ directory: dir, maxSize: 2 });
    await small.ready;
    await small.set('a', 1);
    await small.set('b', 2);
    await small.set('c', 3);

    const readdirSpy = jest.spyOn(small, 'getCacheFiles');
    await Promise.all([
      small.evictIfNeeded(),
      small.evictIfNeeded(),
      small.evictIfNeeded(),
    ]);

    // One directory scan, not three — otherwise every concurrent set() past the
    // threshold starts its own full-directory pass.
    expect(readdirSpy).toHaveBeenCalledTimes(1);
    readdirSpy.mockRestore();
  });

  it('leaves the cache usable and under the limit', async () => {
    const small = new FileCache({ directory: dir, maxSize: 5 });
    await small.ready;
    for (let i = 0; i < 12; i += 1) await small.set(`k${i}`, i);

    expect(await small.get('k11')).toBe(11);
    expect(
      fs.readdirSync(dir).filter(f => f.endsWith('.json')).length,
    ).toBeLessThanOrEqual(12);
  });
});

describe('has() and cleanup() delete by identity too', () => {
  /** Replace the file behind a key with a live entry, as another writer would. */
  async function republish(key, value) {
    const filename = cache.getFilename(key);
    await cache.writeFile(filename, {
      key,
      value,
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });
    return filename;
  }

  it('has() does not destroy an entry republished under it', async () => {
    await cache.set('hot', 'stale-value', -1000);

    const filename = cache.getFilename('hot');
    const readFile = cache.readFile.bind(cache);
    // Republish between has()'s read and its unlink — the exact window that
    // makes a path-based delete throw away a live write.
    jest.spyOn(cache, 'readFile').mockImplementationOnce(async name => {
      const data = await readFile(name);
      await republish('hot', 'fresh-value');
      return data;
    });

    await expect(cache.has('hot')).resolves.toBe(false);

    jest.restoreAllMocks();
    expect(await cache.get('hot')).toBe('fresh-value');
    expect(await cache.fileIdentity(filename)).not.toBeNull();
  });

  it('cleanup() does not destroy an entry republished under it', async () => {
    // cleanup() is the registered shutdown hook, so it runs while in-flight
    // set() calls are still draining in the same process.
    await cache.set('draining', 'stale-value', -1000);

    const readFile = cache.readFile.bind(cache);
    jest.spyOn(cache, 'readFile').mockImplementationOnce(async name => {
      const data = await readFile(name);
      await republish('draining', 'fresh-value');
      return data;
    });

    await cache.cleanup();

    jest.restoreAllMocks();
    expect(await cache.get('draining')).toBe('fresh-value');
  });

  it('cleanup() still removes an entry nothing replaced', async () => {
    await cache.set('expired', 'v', -1000);

    const removed = await cache.cleanup();

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await cache.get('expired')).toBeNull();
  });
});

describe('housekeeping reports failures instead of swallowing them', () => {
  // mapLimit never rejects — it settles every task and returns one result
  // object per item — so `await mapLimit(...)` inside a try/catch discards
  // every failure and the catch is dead code. Carrying on past a failed unlink
  // is right for housekeeping; carrying on *silently* is how a cache that can
  // no longer delete anything looks healthy while it grows past maxSize on
  // every set(), retrying the same doomed sweep forever with no signal.
  let errors;

  beforeEach(() => {
    errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    errors.mockRestore();
    await fsp.chmod(dir, 0o700).catch(() => {});
  });

  it('clear() reports unlink failures', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);

    // Read+execute but not write: the entries are listable and readable, and
    // unlink is refused with EACCES.
    await fsp.chmod(dir, 0o500);
    await cache.clear();

    expect(errors).toHaveBeenCalled();
    expect(errors.mock.calls.flat().join(' ')).toMatch(/clear/i);
  });

  it('evictIfNeeded() reports unlink failures', async () => {
    const small = new FileCache({ directory: dir, maxSize: 2 });
    await small.ready;
    await small.set('a', 1);
    await small.set('b', 2);
    await small.set('c', 3);

    await fsp.chmod(dir, 0o500);
    await small.evictIfNeeded();

    expect(errors).toHaveBeenCalled();
    expect(errors.mock.calls.flat().join(' ')).toMatch(/evict/i);
  });
});
