/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

import { PathEscapeError } from '@shared/utils/atomic/index.js';

import { LocalFilesystemProvider } from './local.js';

let basePath;
let provider;
let outside;

beforeEach(async () => {
  basePath = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'xnapify-local-provider-'),
  );
  outside = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-outside-'));
  provider = new LocalFilesystemProvider({ basePath });
});

afterEach(async () => {
  await fsp.rm(basePath, { recursive: true, force: true });
  await fsp.rm(outside, { recursive: true, force: true });
});

describe('LocalFilesystemProvider path containment', () => {
  it('resolves ordinary names inside the base path', () => {
    expect(provider.getFilePath('avatar.png')).toBe(
      path.join(basePath, 'avatar.png'),
    );
    expect(provider.getFilePath('nested/avatar.png')).toBe(
      path.join(basePath, 'nested', 'avatar.png'),
    );
  });

  it('refuses to escape the upload directory via traversal', () => {
    // Reachable from GET /api/auth/profile/avatar?fileName=… — the query
    // parameter is passed straight through to the provider, so a bare
    // path.join here served any file the process could read.
    expect(() => provider.getFilePath('../../../../etc/passwd')).toThrow(
      PathEscapeError,
    );
    expect(() => provider.getFilePath('a/../../../../etc/hosts')).toThrow(
      PathEscapeError,
    );
  });

  it('refuses an absolute path rather than reinterpreting it as relative', () => {
    expect(() => provider.getFilePath('/etc/passwd')).toThrow(PathEscapeError);
  });

  it('does not let a traversing name reach the filesystem at all', async () => {
    const secret = path.join(outside, 'secret.txt');
    await fsp.writeFile(secret, 'top secret');
    const traversal = path.relative(basePath, secret);

    // Sanity: the name really does point at the file we planted.
    expect(path.resolve(basePath, traversal)).toBe(secret);

    // The operations layer wraps provider errors in FilesystemError, so assert
    // the security property — rejected, and the file never touched — rather
    // than the concrete class.
    await expect(provider.retrieve(traversal)).rejects.toThrow(
      /escapes its base directory/,
    );
    // exists() reports rather than throws, so containment shows up as `false`.
    // Before the fix it returned true for any file the process could stat — an
    // existence oracle for the entire filesystem.
    await expect(provider.exists(traversal)).resolves.toBe(false);
    await expect(provider.delete(traversal)).rejects.toThrow(
      /escapes its base directory/,
    );
    // The planted file must still be there — delete() must not have reached it.
    await expect(fsp.readFile(secret, 'utf8')).resolves.toBe('top secret');
  });

  it('confines both sides of copy and move', async () => {
    await fsp.writeFile(path.join(basePath, 'ok.txt'), 'data');

    await expect(provider.copy('ok.txt', '../escaped.txt')).rejects.toThrow(
      /escapes its base directory/,
    );
    await expect(provider.move('ok.txt', '../escaped.txt')).rejects.toThrow(
      /escapes its base directory/,
    );
    // The source survives a rejected move.
    await expect(
      fsp.readFile(path.join(basePath, 'ok.txt'), 'utf8'),
    ).resolves.toBe('data');
  });
});

describe('LocalFilesystemProvider stream storage', () => {
  // A source that dies mid-body: a client that walks away from a multipart
  // upload, a provider-to-provider copy whose reader errors, a full disk.
  const abortingSource = () =>
    new Readable({
      read() {
        this.push(Buffer.alloc(32 * 1024, 'a'));
        this.destroy(new Error('client aborted'));
      },
    });

  it('stores a stream and reports what landed on disk', async () => {
    const metadata = await provider.store(
      'upload.bin',
      Readable.from([Buffer.from('hello '), Buffer.from('world')]),
    );

    expect(metadata.size).toBe(11);
    await expect(
      fsp.readFile(path.join(basePath, 'upload.bin'), 'utf8'),
    ).resolves.toBe('hello world');
  });

  it('publishes nothing when the source stream fails mid-body', async () => {
    await expect(
      provider.store('upload.bin', abortingSource()),
    ).rejects.toThrow(/client aborted/);

    // Piping into the destination itself left a readable, wrong-length file
    // under the very name the caller had just been told failed to store.
    await expect(provider.exists('upload.bin')).resolves.toBe(false);
    // And it must cost no disk either: a rejected upload that leaves its bytes
    // behind under any name is a leak nothing in the app ever reclaims.
    await expect(fsp.readdir(basePath)).resolves.toEqual([]);
  });

  it('leaves the previous contents of the name untouched when a stream fails', async () => {
    await fsp.writeFile(path.join(basePath, 'avatar.png'), 'original');

    await expect(
      provider.store('avatar.png', abortingSource()),
    ).rejects.toThrow(/client aborted/);

    await expect(
      fsp.readFile(path.join(basePath, 'avatar.png'), 'utf8'),
    ).resolves.toBe('original');
  });

  it('rejects an oversized stream without disturbing the name it targeted', async () => {
    const strict = new LocalFilesystemProvider({ basePath, maxFileSize: 8 });
    await strict.ready;
    await fsp.writeFile(path.join(basePath, 'avatar.png'), 'original');

    await expect(
      strict.store('avatar.png', Readable.from([Buffer.alloc(64, 'a')])),
    ).rejects.toThrow(/File size exceeds limit/);

    await expect(
      fsp.readFile(path.join(basePath, 'avatar.png'), 'utf8'),
    ).resolves.toBe('original');
    await expect(fsp.readdir(basePath)).resolves.toEqual(['avatar.png']);
  });
});

describe('LocalFilesystemProvider startup sweep', () => {
  it('reclaims temps abandoned by a writer that never finished', async () => {
    const abandoned = path.join(basePath, 'upload.bin.p1-1-deadbeef.tmp');
    const inFlight = path.join(basePath, 'upload.bin.p2-1-cafebabe.tmp');
    await fsp.writeFile(abandoned, 'half an upload');
    await fsp.writeFile(inFlight, 'still being written');
    // Older than the provider's boot-sweep grace, which is an hour rather than
    // the module default: this sweep runs on every worker boot, so it must not
    // be able to take an upload another worker is still streaming.
    const longAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await fsp.utimes(abandoned, longAgo, longAgo);

    const booted = new LocalFilesystemProvider({ basePath });
    await booted.ready;

    await expect(fsp.access(abandoned)).rejects.toThrow();
    // Age is the only thing separating an abandoned temp from a live one, so a
    // temp younger than the grace window has to survive the sweep.
    await expect(fsp.access(inFlight)).resolves.toBeUndefined();
  });

  it('never sweeps a stored file just because its name ends in .tmp', async () => {
    // Upload filenames come from users, and `notes.tmp` is a perfectly ordinary
    // thing to store. Matching the suffix alone would delete it on the next
    // worker boot.
    const userFile = path.join(basePath, 'notes.tmp');
    await fsp.writeFile(userFile, 'user content');
    const longAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await fsp.utimes(userFile, longAgo, longAgo);

    const booted = new LocalFilesystemProvider({ basePath });
    await booted.ready;

    await expect(fsp.readFile(userFile, 'utf8')).resolves.toBe('user content');
  });

  it('preserves the permissions of a file the stream path replaces', async () => {
    const { Readable } = await import('node:stream');
    await provider.store('secret.bin', Buffer.from('v1'));
    await fsp.chmod(path.join(basePath, 'secret.bin'), 0o600);

    await provider.store('secret.bin', Readable.from([Buffer.from('v2')]));

    const mode =
      (await fsp.stat(path.join(basePath, 'secret.bin'))).mode & 0o777;
    expect(mode).toBe(0o600);
    await expect(
      fsp.readFile(path.join(basePath, 'secret.bin'), 'utf8'),
    ).resolves.toBe('v2');
  });
});

describe('LocalFilesystemProvider move', () => {
  const seed = (name, body) =>
    fsp.writeFile(path.join(basePath, name), body, 'utf8');
  const read = name => fsp.readFile(path.join(basePath, name), 'utf8');

  it('refuses a destination that was taken after the caller checked', async () => {
    await seed('source.txt', 'mine');

    // The whole window in one line: the caller asks, is told the name is
    // free, and by the time it moves, another request owns it. rename(2)
    // replaces the winner's file with no error and no trace.
    const lookedFree = !(await provider.exists('dest.txt'));
    await seed('dest.txt', 'someone else got here first');
    expect(lookedFree).toBe(true);

    await expect(
      provider.move('source.txt', 'dest.txt', { overwrite: false }),
    ).rejects.toMatchObject({ code: 'TARGET_EXISTS', statusCode: 409 });

    await expect(read('dest.txt')).resolves.toBe('someone else got here first');
    // And the move did not half-happen: the source is still where it was.
    await expect(read('source.txt')).resolves.toBe('mine');
  });

  it('leaves one name behind, not two, on a successful no-clobber move', async () => {
    await seed('source.txt', 'payload');

    const result = await provider.move('source.txt', 'dest.txt', {
      overwrite: false,
    });

    expect(result.size).toBe('payload'.length);
    await expect(read('dest.txt')).resolves.toBe('payload');
    await expect(provider.exists('source.txt')).resolves.toBe(false);
  });

  it('still replaces the destination when overwrite is asked for', async () => {
    await seed('source.txt', 'new');
    await seed('dest.txt', 'old');

    await provider.move('source.txt', 'dest.txt');

    await expect(read('dest.txt')).resolves.toBe('new');
    await expect(provider.exists('source.txt')).resolves.toBe(false);
  });
});

describe('LocalFilesystemProvider copy', () => {
  const seed = (name, body) =>
    fsp.writeFile(path.join(basePath, name), body, 'utf8');
  const read = name => fsp.readFile(path.join(basePath, name), 'utf8');

  it('leaves the destination untouched when the copy fails part-way', async () => {
    await seed('source.txt', 'new payload');
    await seed('dest.txt', 'the file that was already there');

    // A full disk partway through. copyFile opens the destination O_TRUNC and
    // streams into it, so without a temp this destroys dest.txt and leaves a
    // truncated file that exists() and getMetadata() both call valid.
    const realCopyFile = fsp.copyFile;
    jest
      .spyOn(fsp, 'copyFile')
      .mockImplementation(async (src, target, mode) => {
        await realCopyFile(src, target, mode);
        throw Object.assign(new Error('ENOSPC: no space left on device'), {
          code: 'ENOSPC',
        });
      });

    try {
      await expect(provider.copy('source.txt', 'dest.txt')).rejects.toThrow(
        /ENOSPC/,
      );
    } finally {
      jest.restoreAllMocks();
    }

    await expect(read('dest.txt')).resolves.toBe(
      'the file that was already there',
    );
    // And nothing was left behind under a temp name either.
    const stray = (await fsp.readdir(basePath)).filter(n => n.includes('.tmp'));
    expect(stray).toEqual([]);
  });

  it('refuses a destination taken after the caller checked', async () => {
    await seed('source.txt', 'mine');

    const lookedFree = !(await provider.exists('dest.txt'));
    await seed('dest.txt', 'someone else got here first');
    expect(lookedFree).toBe(true);

    await expect(
      provider.copy('source.txt', 'dest.txt', { overwrite: false }),
    ).rejects.toMatchObject({ code: 'TARGET_EXISTS', statusCode: 409 });

    await expect(read('dest.txt')).resolves.toBe('someone else got here first');
  });

  it('preserves the permissions of the file it replaces', async () => {
    await seed('source.txt', 'new');
    await seed('dest.txt', 'old');
    await fsp.chmod(path.join(basePath, 'dest.txt'), 0o600);

    await provider.copy('source.txt', 'dest.txt');

    const mode = (await fsp.stat(path.join(basePath, 'dest.txt'))).mode & 0o777;
    expect(mode).toBe(0o600);
    await expect(read('dest.txt')).resolves.toBe('new');
  });

  it('copies a source the caller has no write permission on', async () => {
    // copyFile carries the source's mode onto the temp, so a read-only source
    // produces a read-only temp. Reopening that temp 'r+' purely to fsync it
    // then fails EACCES and the whole copy is rejected — even though fsync
    // needs no write access at all. Read-only sources are ordinary: anything
    // seeded from a package, a build artefact, or a deliberately locked file.
    await seed('source.txt', 'payload');
    await fsp.chmod(path.join(basePath, 'source.txt'), 0o444);

    const result = await provider.copy('source.txt', 'dest.txt');

    expect(result.size).toBe('payload'.length);
    await expect(read('dest.txt')).resolves.toBe('payload');
  });

  it('still copies normally when nothing goes wrong', async () => {
    await seed('source.txt', 'payload');

    const result = await provider.copy('source.txt', 'dest.txt');

    expect(result.size).toBe('payload'.length);
    await expect(read('dest.txt')).resolves.toBe('payload');
    await expect(read('source.txt')).resolves.toBe('payload');
  });
});

describe('LocalFilesystemProvider error messages', () => {
  it('does not leak the absolute upload root in a client-facing error', async () => {
    // The message this constructs is the one that reaches an HTTP client
    // through the upload middleware and sendValidationError — neither of
    // which scrubs a filesystem path out of a string value — so any
    // non-ENOENT local fs failure otherwise hands out the host's real upload
    // directory, in a message a real EACCES/ENAMETOOLONG carries by default.
    const target = path.join(basePath, 'locked.txt');
    await fsp.writeFile(target, 'secret');
    jest
      .spyOn(fsp, 'stat')
      .mockRejectedValueOnce(
        Object.assign(
          new Error(`EACCES: permission denied, stat '${target}'`),
          { code: 'EACCES' },
        ),
      );

    const error = await provider.getMetadata('locked.txt').catch(e => e);

    expect(error.message).toContain('EACCES');
    expect(error.message).not.toContain(basePath);

    jest.restoreAllMocks();
  });
});

describe('LocalFilesystemProvider list', () => {
  beforeEach(async () => {
    await fsp.mkdir(path.join(basePath, 'nested'), { recursive: true });
    await fsp.writeFile(path.join(basePath, 'top.txt'), 'top');
    await fsp.writeFile(path.join(basePath, 'nested', 'deep.txt'), 'deep');
  });

  it('reports one kind of path for every depth of a recursive listing', async () => {
    // The top level reported paths relative to basePath while nested entries
    // reported absolute ones — a single array with two contracts, disclosing
    // the host's upload directory in half its rows.
    const entries = await provider.list('', {
      recursive: true,
      filesOnly: true,
    });

    const paths = entries.map(entry => entry.path).sort();
    expect(paths).toEqual([path.join('nested', 'deep.txt'), 'top.txt']);
    expect(paths.some(p => path.isAbsolute(p))).toBe(false);
  });

  it('descends into directories even when only files are reported', async () => {
    // The type filter used to `continue` past a directory before the
    // recursion could run, so `filesOnly` silently cancelled `recursive` and
    // returned the top level alone.
    const entries = await provider.list('', {
      recursive: true,
      filesOnly: true,
    });

    expect(entries.every(entry => entry.isFile)).toBe(true);
    expect(entries.map(entry => entry.name).sort()).toEqual([
      'deep.txt',
      'top.txt',
    ]);
  });

  it('keeps absolute paths absolute at every depth when asked absolutely', async () => {
    const entries = await provider.list(basePath, {
      recursive: true,
      filesOnly: true,
    });

    expect(entries.every(entry => path.isAbsolute(entry.path))).toBe(true);
    expect(entries).toHaveLength(2);
  });
});
