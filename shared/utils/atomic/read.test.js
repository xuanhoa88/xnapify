/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AtomicFileError, CorruptFileError } from './errors.js';
import {
  pathExists,
  readFileSafe,
  readJsonSafe,
  readJsonSafeSync,
} from './read.js';
import { writeJsonAtomic } from './write.js';

let dir;
let errorSpy;

beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-atomic-read-'));
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  errorSpy.mockRestore();
  await fsp.rm(dir, { recursive: true, force: true });
});

describe('readFileSafe', () => {
  it('returns the fallback for a missing file', async () => {
    expect(await readFileSafe(path.join(dir, 'nope'), { fallback: 'FB' })).toBe(
      'FB',
    );
  });

  it('does not disguise a permission error as a missing file', async () => {
    // Reporting EACCES as "absent" turns a misconfigured deployment into a
    // permanent silent cache miss that no alert ever fires on.
    const file = path.join(dir, 'locked');
    await fsp.writeFile(file, 'secret');
    await fsp.chmod(file, 0o000);

    // Root ignores permission bits, so this assertion only means something
    // for an unprivileged test runner.
    if (typeof process.getuid === 'function' && process.getuid() === 0) return;

    await expect(readFileSafe(file, { fallback: 'FB' })).rejects.toMatchObject({
      code: 'EACCES',
    });
  });

  it('refuses a file larger than maxBytes instead of buffering it', async () => {
    const file = path.join(dir, 'big');
    await fsp.writeFile(file, 'x'.repeat(2048));

    await expect(readFileSafe(file, { maxBytes: 1024 })).rejects.toThrow(
      CorruptFileError,
    );
  });

  it('rejects a directory rather than returning its listing', async () => {
    await expect(readFileSafe(dir)).rejects.toThrow(AtomicFileError);
  });

  it('refuses a path that is not a regular file', async () => {
    // maxBytes is enforced against stat().size, and a FIFO, socket or
    // character device reports size 0 — so the limit passes and the
    // unbounded read that follows never ends. A symlink to /dev/zero
    // allocates until the process is killed, which turns any caller that
    // takes a path from configuration or a request into a way to OOM the
    // host. /dev/null stands in here because it is the same class of file
    // and returns EOF immediately, so the test proves the guard without
    // risking the machine it runs on.
    await expect(readFileSafe('/dev/null')).rejects.toThrow(/regular file/i);
  });

  it('returns a Buffer when encoding is null', async () => {
    const file = path.join(dir, 'bin');
    await fsp.writeFile(file, Buffer.from([1, 2, 3]));
    expect(await readFileSafe(file, { encoding: null })).toEqual(
      Buffer.from([1, 2, 3]),
    );
  });
});

describe('readJsonSafe', () => {
  it('round-trips a value written by writeJsonAtomic', async () => {
    const file = path.join(dir, 'a.json');
    await writeJsonAtomic(file, { a: 1, nested: { b: [1, 2] } });
    expect(await readJsonSafe(file)).toEqual({ a: 1, nested: { b: [1, 2] } });
  });

  it('returns the fallback for a missing file', async () => {
    expect(
      await readJsonSafe(path.join(dir, 'nope.json'), { fallback: {} }),
    ).toEqual({});
  });

  it('throws CorruptFileError for a truncated file rather than a bare SyntaxError', async () => {
    // A SyntaxError has no `err.code`, so the `if (err.code === 'ENOENT')`
    // guard every adapter uses lets it escape and kill the process.
    const file = path.join(dir, 'torn.json');
    await fsp.writeFile(file, '{"a":1,"b');

    const error = await readJsonSafe(file).catch(e => e);
    expect(error).toBeInstanceOf(CorruptFileError);
    expect(error.path).toBe(file);
    expect(error.raw).toBe('{"a":1,"b');
  });

  it('treats an empty file as corrupt, not as absent', async () => {
    // An atomic write never publishes a zero-byte file, so one means something
    // truncated it. Calling that "not there yet" hides the incident.
    const file = path.join(dir, 'empty.json');
    await fsp.writeFile(file, '');

    await expect(readJsonSafe(file)).rejects.toThrow(CorruptFileError);
    expect(
      await readJsonSafe(file, { onCorrupt: 'fallback', fallback: 'FB' }),
    ).toBe('FB');
  });

  it('quarantines a corrupt file instead of deleting the evidence', async () => {
    const file = path.join(dir, 'torn.json');
    await fsp.writeFile(file, 'not json at all');

    const result = await readJsonSafe(file, {
      onCorrupt: 'quarantine',
      fallback: null,
    });

    expect(result).toBeNull();
    await expect(fsp.access(file)).rejects.toMatchObject({ code: 'ENOENT' });
    const quarantined = await fsp.readdir(path.join(dir, 'corrupt'));
    expect(quarantined).toHaveLength(1);
    expect(
      await fsp.readFile(path.join(dir, 'corrupt', quarantined[0]), 'utf8'),
    ).toBe('not json at all');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('applies validate so a parseable but wrong-shaped file is caught', async () => {
    const file = path.join(dir, 'null.json');
    await fsp.writeFile(file, 'null');

    await expect(
      readJsonSafe(file, {
        validate: v => v !== null && typeof v === 'object',
      }),
    ).rejects.toThrow(CorruptFileError);
  });
});

describe('readJsonSafeSync', () => {
  it('mirrors the async corruption handling', async () => {
    const file = path.join(dir, 'torn.json');
    await fsp.writeFile(file, '{');

    expect(() => readJsonSafeSync(file)).toThrow(CorruptFileError);
    expect(readJsonSafeSync(file, { onCorrupt: 'fallback', fallback: 7 })).toBe(
      7,
    );
  });
});

describe('pathExists', () => {
  it('reports presence without throwing', async () => {
    expect(await pathExists(dir)).toBe(true);
    expect(await pathExists(path.join(dir, 'nope'))).toBe(false);
  });
});
