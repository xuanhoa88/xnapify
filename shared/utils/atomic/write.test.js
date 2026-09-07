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

import { AtomicFileError } from './errors.js';
import {
  TEMP_SUFFIX_PATTERN,
  ensureDir,
  tempSuffix,
  writeFileAtomic,
  writeFileAtomicSync,
  writeJsonAtomic,
  writeJsonAtomicSync,
} from './write.js';

let dir;

beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-atomic-write-'));
});

afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true });
});

const leftoverTemps = async () =>
  (await fsp.readdir(dir)).filter(name => name.endsWith('.tmp'));

describe('tempSuffix', () => {
  it('never repeats, even for writes inside the same millisecond', () => {
    // The defect this replaces used `Date.now()`, which repeats for every
    // write in the same millisecond and lets two writers share a temp file.
    const suffixes = new Set(Array.from({ length: 10_000 }, tempSuffix));
    expect(suffixes.size).toBe(10_000);
  });

  it('produces suffixes the sweeper can recognise', () => {
    expect(tempSuffix()).toMatch(TEMP_SUFFIX_PATTERN);
  });
});

describe('writeFileAtomic', () => {
  it('writes a new file and leaves no temp behind', async () => {
    const file = path.join(dir, 'a.txt');
    await writeFileAtomic(file, 'hello');

    expect(await fsp.readFile(file, 'utf8')).toBe('hello');
    expect(await leftoverTemps()).toEqual([]);
  });

  it('creates the parent directory', async () => {
    const file = path.join(dir, 'deep', 'nested', 'a.txt');
    await writeFileAtomic(file, 'hello');
    expect(await fsp.readFile(file, 'utf8')).toBe('hello');
  });

  it('writes Buffers without mangling them through an encoding', async () => {
    const file = path.join(dir, 'bin');
    const payload = Buffer.from([0x00, 0xff, 0x80, 0x7f]);
    await writeFileAtomic(file, payload);
    expect(await fsp.readFile(file)).toEqual(payload);
  });

  it('preserves the permissions of the file it replaces', async () => {
    // A temp file is created fresh and picks up the umask, so a naive
    // tmp+rename silently widens a 0600 secret to 0644 on every write.
    const file = path.join(dir, 'secret');
    await writeFileAtomic(file, 'v1');
    await fsp.chmod(file, 0o600);

    await writeFileAtomic(file, 'v2');

    expect((await fsp.stat(file)).mode & 0o777).toBe(0o600);
    expect(await fsp.readFile(file, 'utf8')).toBe('v2');
  });

  it('honours an explicit mode for a file that does not exist yet', async () => {
    const file = path.join(dir, 'fresh-secret');
    await writeFileAtomic(file, 'v1', { mode: 0o600 });
    expect((await fsp.stat(file)).mode & 0o777).toBe(0o600);
  });

  it('leaves the previous contents intact when the write fails', async () => {
    // Renaming a file over a directory fails; the original must survive and
    // the temp must not be left behind.
    const target = path.join(dir, 'occupied');
    await ensureDir(target);
    await fsp.writeFile(path.join(target, 'child'), 'x');

    await expect(writeFileAtomic(target, 'nope')).rejects.toThrow(
      AtomicFileError,
    );

    expect((await fsp.stat(target)).isDirectory()).toBe(true);
    expect(await leftoverTemps()).toEqual([]);
  });

  it('never publishes a torn file under concurrent writers', async () => {
    // The core guarantee: whichever writer wins, a reader sees one complete
    // payload — never a mixture, never a truncation.
    const file = path.join(dir, 'contended.json');
    const payloads = Array.from({ length: 50 }, (_, i) => ({
      writer: i,
      filler: 'x'.repeat(20_000),
    }));

    await Promise.all(payloads.map(p => writeJsonAtomic(file, p)));

    const parsed = JSON.parse(await fsp.readFile(file, 'utf8'));
    expect(parsed.filler).toHaveLength(20_000);
    expect(payloads.map(p => p.writer)).toContain(parsed.writer);
    expect(await leftoverTemps()).toEqual([]);
  });

  it('keeps the temp file in the target directory so rename cannot cross devices', async () => {
    // A temp in os.tmpdir() makes rename EXDEV wherever /tmp is its own mount,
    // which is nearly every container.
    const file = path.join(dir, 'a.txt');
    let observed = null;
    const realOpen = fsp.open;
    const spy = jest.spyOn(fsp, 'open').mockImplementation((p, ...rest) => {
      if (String(p).endsWith('.tmp')) observed = String(p);
      return realOpen.call(fsp, p, ...rest);
    });

    await writeFileAtomic(file, 'hello');
    spy.mockRestore();

    expect(observed).not.toBeNull();
    expect(path.dirname(observed)).toBe(path.dirname(file));
  });
});

describe('writeJsonAtomic', () => {
  it('round-trips through readFile with a trailing newline', async () => {
    const file = path.join(dir, 'a.json');
    await writeJsonAtomic(file, { a: 1 }, { spaces: 2 });
    const raw = await fsp.readFile(file, 'utf8');

    expect(raw.endsWith('\n')).toBe(true);
    expect(JSON.parse(raw)).toEqual({ a: 1 });
  });

  it('refuses a value JSON.stringify cannot represent instead of writing "undefined"', async () => {
    const file = path.join(dir, 'a.json');
    await expect(writeJsonAtomic(file, undefined)).rejects.toThrow(
      AtomicFileError,
    );
    await expect(fsp.access(file)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('propagates a circular-structure failure without leaving a temp', async () => {
    const file = path.join(dir, 'a.json');
    const circular = {};
    circular.self = circular;

    await expect(writeJsonAtomic(file, circular)).rejects.toThrow();
    expect(await leftoverTemps()).toEqual([]);
  });
});

describe('sync variants', () => {
  it('match the async behaviour for content and permissions', () => {
    const file = path.join(dir, 'sync.json');
    writeJsonAtomicSync(file, { a: 1 });
    fs.chmodSync(file, 0o600);
    writeJsonAtomicSync(file, { a: 2 });

    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ a: 2 });
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(dir).filter(n => n.endsWith('.tmp'))).toEqual([]);
  });

  it('cleans up the temp when the rename fails', () => {
    const target = path.join(dir, 'occupied');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'child'), 'x');

    expect(() => writeFileAtomicSync(target, 'nope')).toThrow(AtomicFileError);
    expect(fs.readdirSync(dir).filter(n => n.endsWith('.tmp'))).toEqual([]);
  });
});
