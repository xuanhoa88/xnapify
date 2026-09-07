/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { PassThrough, Readable } from 'stream';

import unzipper from 'unzipper';

import { extractZip } from './zipUtils.js';

jest.mock('unzipper', () => ({
  Open: { buffer: jest.fn(), file: jest.fn() },
}));

const fakeEntry = (entryPath, content = 'x') => ({
  path: entryPath,
  type: 'File',
  uncompressedSize: content.length,
  stream: () => Readable.from([Buffer.from(content)]),
});

/**
 * An entry that delivers `chunks` regardless of the size it declares - the
 * shape of both a decompression bomb and a truncated download.
 */
const lyingEntry = (entryPath, declaredSize, chunks) => ({
  path: entryPath,
  type: 'File',
  uncompressedSize: declaredSize,
  stream: () => Readable.from(chunks),
});

describe('extractZip — zip-slip protection', () => {
  let root;
  let extractDir;

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zip-slip-'));
    extractDir = path.join(root, 'target');
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  async function run(entries) {
    unzipper.Open.buffer.mockResolvedValue({ files: entries });
    return extractZip(Buffer.from('zip'), extractDir);
  }

  it('extracts normal nested entries', async () => {
    const result = await run([fakeEntry('a/b.txt', 'hello')]);
    expect(result.errors).toHaveLength(0);
    expect(
      await fs.promises.readFile(path.join(extractDir, 'a/b.txt'), 'utf8'),
    ).toBe('hello');
  });

  it('rejects parent-directory traversal', async () => {
    const result = await run([fakeEntry('../evil.txt')]);
    expect(result.errors).toEqual([
      { fileName: '../evil.txt', error: 'ZIP_INVALID_FILE_PATH' },
    ]);
    expect(fs.existsSync(path.join(root, 'evil.txt'))).toBe(false);
  });

  it('rejects the sibling-prefix bypass ("target-evil" vs "target")', async () => {
    const result = await run([fakeEntry('../target-evil/pwn.txt')]);
    expect(result.errors[0]).toMatchObject({ error: 'ZIP_INVALID_FILE_PATH' });
    expect(fs.existsSync(path.join(root, 'target-evil'))).toBe(false);
  });

  it('rejects absolute entry paths', async () => {
    const abs = path.join(root, 'outside.txt');
    const result = await run([fakeEntry(abs)]);
    expect(result.errors[0]).toMatchObject({ error: 'ZIP_INVALID_FILE_PATH' });
    expect(fs.existsSync(abs)).toBe(false);
  });

  it('rejects an entry that resolves to the extraction root itself', async () => {
    const result = await run([fakeEntry('.')]);
    expect(result.errors[0]).toMatchObject({ error: 'ZIP_INVALID_FILE_PATH' });
  });
});

describe('extractZip — failed entry streams', () => {
  let root;
  let extractDir;

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zip-fail-'));
    extractDir = path.join(root, 'target');
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  it('leaves no truncated entry behind when the source stream fails', async () => {
    const corruptEntry = {
      path: 'pkg/manifest.json',
      type: 'File',
      uncompressedSize: 4096,
      stream: () => {
        const source = new PassThrough();
        source.write(Buffer.from('{"name":"half-'));
        // unzipper emits 'error' on a bare PassThrough without destroying it
        // (Open/unzip.js), and the delay puts the failure after the first
        // chunk has reached the disk - the state that strands a partial file.
        setTimeout(() => source.emit('error', new Error('CORRUPT_ENTRY')), 10);
        return source;
      },
    };

    unzipper.Open.buffer.mockResolvedValue({ files: [corruptEntry] });
    const result = await extractZip(Buffer.from('zip'), extractDir);

    expect(result.errors).toEqual([
      { fileName: 'pkg/manifest.json', error: 'CORRUPT_ENTRY' },
    ]);
    expect(result.extractedFiles).toHaveLength(0);
    expect(fs.existsSync(path.join(extractDir, 'pkg/manifest.json'))).toBe(
      false,
    );
  });
});

describe('extractZip — decompression bombs', () => {
  let root;
  let extractDir;

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zip-bomb-'));
    extractDir = path.join(root, 'target');
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const megabyte = () => Buffer.alloc(1024 * 1024, 0x41);

  it('aborts an entry that inflates past the size it declared', async () => {
    unzipper.Open.buffer.mockResolvedValue({
      files: [lyingEntry('bomb.bin', 1024, [megabyte(), megabyte()])],
    });

    const result = await extractZip(Buffer.from('zip'), extractDir, {
      maxSize: 4 * 1024 * 1024,
    });

    expect(result.errors[0].error).toMatch(/expands beyond its allowed size/);
    expect(result.extractedFiles).toHaveLength(0);
    expect(result.totalSize).toBe(0);
    expect(fs.existsSync(path.join(extractDir, 'bomb.bin'))).toBe(false);
  });

  it('holds an entry declaring no size to the archive-wide budget', async () => {
    unzipper.Open.buffer.mockResolvedValue({
      files: [
        lyingEntry('bomb.bin', undefined, [megabyte(), megabyte(), megabyte()]),
      ],
    });

    const result = await extractZip(Buffer.from('zip'), extractDir, {
      maxSize: 1024 * 1024,
    });

    expect(result.errors[0].error).toMatch(/expands beyond its allowed size/);
    expect(fs.existsSync(path.join(extractDir, 'bomb.bin'))).toBe(false);
  });

  it('reports the bytes it actually wrote, not the declared size', async () => {
    unzipper.Open.buffer.mockResolvedValue({
      files: [lyingEntry('small.txt', 4096, [Buffer.from('hello')])],
    });

    const result = await extractZip(Buffer.from('zip'), extractDir);

    expect(result.errors).toHaveLength(0);
    expect(result.totalSize).toBe(5);
    expect(result.extractedFiles[0]).toMatchObject({ size: 5 });
  });
});

describe('extractZip — archive-level guards', () => {
  let root;
  let extractDir;
  let zipPath;

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zip-src-'));
    extractDir = path.join(root, 'target');
    zipPath = path.join(root, 'package.zip');
    await fs.promises.writeFile(zipPath, Buffer.alloc(4096, 0x50));
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  it('opens a path through the central directory, never a whole-file read', async () => {
    const readFile = jest.spyOn(fs.promises, 'readFile');
    unzipper.Open.file.mockResolvedValue({ files: [fakeEntry('a.txt', 'hi')] });

    const result = await extractZip(zipPath, extractDir);

    expect(unzipper.Open.file).toHaveBeenCalledWith(zipPath);
    expect(unzipper.Open.buffer).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalledWith(zipPath);
    expect(result.extractedFiles).toHaveLength(1);
  });

  it('rejects an oversized archive before parsing it', async () => {
    await expect(
      extractZip(zipPath, extractDir, { maxSize: 1024 }),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', statusCode: 400 });

    expect(unzipper.Open.file).not.toHaveBeenCalled();
    expect(unzipper.Open.buffer).not.toHaveBeenCalled();
  });

  it('reports a missing archive as not found', async () => {
    await expect(
      extractZip(path.join(root, 'absent.zip'), extractDir),
    ).rejects.toMatchObject({ code: 'FILE_NOT_FOUND', statusCode: 404 });
  });
});
