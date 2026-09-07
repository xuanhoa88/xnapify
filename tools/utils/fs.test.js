/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { copyDir, getFileInfo, pathExists } from './fs.js';

let workDir;

beforeEach(async () => {
  workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-tools-fs-'));
});

afterEach(async () => {
  await fsp.chmod(workDir, 0o700).catch(() => {});
  await fsp.rm(workDir, { recursive: true, force: true });
});

describe('pathExists', () => {
  it('answers true for a file that is there and false for one that is not', async () => {
    const present = path.join(workDir, 'present.txt');
    await fsp.writeFile(present, 'x');

    await expect(pathExists(present)).resolves.toBe(true);
    await expect(pathExists(path.join(workDir, 'absent.txt'))).resolves.toBe(
      false,
    );
  });

  it('throws rather than reporting "absent" when it cannot tell', async () => {
    // The build acts on this boolean by skipping work — the LICENSE, the
    // public asset tree — so a permission error read as "not there" ships an
    // incomplete artifact and still exits 0.
    const locked = path.join(workDir, 'locked');
    await fsp.mkdir(locked);
    await fsp.writeFile(path.join(locked, 'asset.txt'), 'x');
    await fsp.chmod(locked, 0o000);

    // Root ignores the permission bits entirely, so this case cannot be
    // provoked there.
    const isRoot = process.getuid && process.getuid() === 0;

    try {
      if (!isRoot) {
        await expect(
          pathExists(path.join(locked, 'asset.txt')),
        ).rejects.toMatchObject({ code: 'EACCES' });
      }
    } finally {
      // Restored here rather than in afterEach: a directory left at 0o000
      // cannot be descended into, so the recursive cleanup would fail on it
      // and report that instead of whatever this test found.
      await fsp.chmod(locked, 0o700);
    }
  });
});

describe('getFileInfo', () => {
  it('reports a size for a miss, so a caller summing sizes cannot reach NaN', async () => {
    const info = await getFileInfo(path.join(workDir, 'absent.txt'));

    expect(info.exists).toBe(false);
    expect(0 + info.size).toBe(0);
  });

  it('reports the real size for a file that is there', async () => {
    const target = path.join(workDir, 'present.txt');
    await fsp.writeFile(target, 'hello');

    const info = await getFileInfo(target);

    expect(info).toMatchObject({ exists: true, size: 5, isFile: true });
  });
});

describe('copyDir', () => {
  it('copies nested files and directories', async () => {
    const source = path.join(workDir, 'src');
    await fsp.mkdir(path.join(source, 'nested'), { recursive: true });
    await fsp.writeFile(path.join(source, 'top.txt'), 'top');
    await fsp.writeFile(path.join(source, 'nested', 'deep.txt'), 'deep');

    const target = path.join(workDir, 'out');
    await copyDir(source, target);

    await expect(
      fsp.readFile(path.join(target, 'top.txt'), 'utf8'),
    ).resolves.toBe('top');
    await expect(
      fsp.readFile(path.join(target, 'nested', 'deep.txt'), 'utf8'),
    ).resolves.toBe('deep');
  });

  it('carries a symlink across instead of silently dropping it', async () => {
    // readdir reports dirent types from lstat, so a symlink is neither
    // isFile() nor isDirectory(). It used to fall through both arms and
    // vanish from the copied tree while the success line still printed —
    // silent data loss in the shipped build artifact, on any tree that
    // vendors a shared asset by symlink.
    const source = path.join(workDir, 'src');
    await fsp.mkdir(source, { recursive: true });
    await fsp.writeFile(path.join(source, 'real.txt'), 'real');
    await fsp.symlink('real.txt', path.join(source, 'link.txt'));

    const target = path.join(workDir, 'out');
    await copyDir(source, target);

    const copied = path.join(target, 'link.txt');
    expect((await fsp.lstat(copied)).isSymbolicLink()).toBe(true);
    await expect(fsp.readlink(copied)).resolves.toBe('real.txt');
    await expect(fsp.readFile(copied, 'utf8')).resolves.toBe('real');
  });
});
