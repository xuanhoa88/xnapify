/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  PathEscapeError,
  resolveWithin,
  resolveWithinReal,
  safeSegment,
} from './paths.js';

let base;

beforeEach(async () => {
  base = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-atomic-paths-'));
});

afterEach(async () => {
  await fsp.rm(base, { recursive: true, force: true });
});

describe('resolveWithin', () => {
  it('resolves ordinary names and nested names inside the base', () => {
    expect(resolveWithin(base, 'a.png')).toBe(path.join(base, 'a.png'));
    expect(resolveWithin(base, 'sub/a.png')).toBe(
      path.join(base, 'sub', 'a.png'),
    );
    expect(resolveWithin(base, './a.png')).toBe(path.join(base, 'a.png'));
    expect(resolveWithin(base, 'sub/../a.png')).toBe(path.join(base, 'a.png'));
  });

  it('rejects traversal out of the base', () => {
    // path.join() would have returned /etc/passwd here quite happily.
    expect(() => resolveWithin(base, '../../../../etc/passwd')).toThrow(
      PathEscapeError,
    );
    expect(() => resolveWithin(base, 'a/../../../../etc/hosts')).toThrow(
      PathEscapeError,
    );
    expect(() => resolveWithin(base, '..')).toThrow(PathEscapeError);
  });

  it('rejects an absolute path instead of silently reinterpreting it', () => {
    // path.join(base, '/etc/passwd') yields base/etc/passwd — a different file
    // than the caller asked for, served without complaint.
    expect(() => resolveWithin(base, '/etc/passwd')).toThrow(PathEscapeError);
  });

  it('rejects a sibling directory that merely shares the base as a prefix', () => {
    // The separator in the containment check is what stops `/uploads-evil`
    // passing a bare startsWith('/uploads').
    expect(() =>
      resolveWithin(base, `../${path.basename(base)}-evil/x`),
    ).toThrow(PathEscapeError);
  });

  it('rejects NUL bytes, which truncate the path at the syscall boundary', () => {
    expect(() => resolveWithin(base, 'safe.png\0../../etc/passwd')).toThrow(
      PathEscapeError,
    );
  });

  it('rejects empty and non-string input', () => {
    expect(() => resolveWithin(base, '')).toThrow(PathEscapeError);
    expect(() => resolveWithin(base, '   ')).toThrow(PathEscapeError);
    expect(() => resolveWithin(base, null)).toThrow(PathEscapeError);
    expect(() => resolveWithin(base, undefined)).toThrow(PathEscapeError);
  });

  it('allows the base directory itself', () => {
    expect(resolveWithin(base, '.')).toBe(path.resolve(base));
  });
});

describe('resolveWithinReal', () => {
  it('accepts a real file inside the base', async () => {
    await fsp.writeFile(path.join(base, 'a.png'), 'x');
    await expect(resolveWithinReal(base, 'a.png')).resolves.toBe(
      path.join(base, 'a.png'),
    );
  });

  it('accepts a path that does not exist yet inside a real directory', async () => {
    await fsp.mkdir(path.join(base, 'sub'));
    await expect(resolveWithinReal(base, 'sub/new.png')).resolves.toBe(
      path.join(base, 'sub', 'new.png'),
    );
  });

  it('rejects a symlink pointing out of the base, which is lexically clean', async () => {
    // `uploads/escape` is a link to /etc, so `uploads/escape/passwd` passes
    // every string check and still reads /etc/passwd.
    const outside = await fsp.mkdtemp(
      path.join(os.tmpdir(), 'xnapify-outside-'),
    );
    await fsp.writeFile(path.join(outside, 'secret.txt'), 'top secret');
    await fsp.symlink(outside, path.join(base, 'escape'), 'dir');

    expect(() => resolveWithin(base, 'escape/secret.txt')).not.toThrow();
    await expect(resolveWithinReal(base, 'escape/secret.txt')).rejects.toThrow(
      PathEscapeError,
    );

    await fsp.rm(outside, { recursive: true, force: true });
  });

  it('rejects a symlinked file itself, not just a symlinked directory', async () => {
    const outside = await fsp.mkdtemp(
      path.join(os.tmpdir(), 'xnapify-outside-'),
    );
    const secret = path.join(outside, 'secret.txt');
    await fsp.writeFile(secret, 'top secret');
    await fsp.symlink(secret, path.join(base, 'link.txt'), 'file');

    await expect(resolveWithinReal(base, 'link.txt')).rejects.toThrow(
      PathEscapeError,
    );

    await fsp.rm(outside, { recursive: true, force: true });
  });

  it('still rejects plain lexical traversal', async () => {
    await expect(resolveWithinReal(base, '../../etc/passwd')).rejects.toThrow(
      PathEscapeError,
    );
  });
});

describe('safeSegment', () => {
  it('reduces a path to its final segment', () => {
    expect(safeSegment('../../etc/passwd')).toBe('passwd');
    expect(safeSegment('a/b/c.txt')).toBe('c.txt');
    expect(safeSegment('plain.txt')).toBe('plain.txt');
  });

  it('handles Windows-style separators', () => {
    expect(safeSegment('..\\..\\windows\\system32\\config')).toBe('config');
  });

  it('rejects input that reduces to nothing usable', () => {
    // `path.basename('..')` is '..', which still means "parent" once joined.
    expect(() => safeSegment('..')).toThrow(PathEscapeError);
    expect(() => safeSegment('.')).toThrow(PathEscapeError);
    expect(() => safeSegment('')).toThrow(PathEscapeError);
    expect(() => safeSegment('/')).toThrow(PathEscapeError);
    expect(() => safeSegment('../')).toThrow(PathEscapeError);
  });

  it('tolerates a trailing separator, which still names a real segment', () => {
    expect(safeSegment('a/b/')).toBe('b');
  });

  it('returns the fallback rather than throwing when one is given', () => {
    expect(safeSegment('..', { fallback: 'upload.bin' })).toBe('upload.bin');
    expect(safeSegment('', { fallback: 'upload.bin' })).toBe('upload.bin');
  });

  it('strips NUL bytes', () => {
    expect(safeSegment('safe.png\0.exe')).toBe('safe.png.exe');
  });
});
