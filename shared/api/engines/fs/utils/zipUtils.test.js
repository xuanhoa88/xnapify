/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';

import unzipper from 'unzipper';

import { extractZip } from './zipUtils.js';

jest.mock('unzipper', () => ({
  Open: { buffer: jest.fn() },
}));

const fakeEntry = (entryPath, content = 'x') => ({
  path: entryPath,
  type: 'File',
  uncompressedSize: content.length,
  stream: () => Readable.from([Buffer.from(content)]),
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
