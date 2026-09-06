/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { installHooks, HOOKS_PATH } from './installHooks.js';

const roots = [];

afterAll(() => {
  roots.forEach(root => fs.rmSync(root, { recursive: true, force: true }));
});

const silent = { log: jest.fn(), warn: jest.fn() };

beforeEach(() => {
  silent.log.mockClear();
  silent.warn.mockClear();
});

/**
 * Create a throwaway working tree containing a hooks directory.
 *
 * @param {{git?: boolean, hooks?: boolean, mode?: number}} options
 */
function makeRoot({ git = true, hooks = true, mode = 0o755 } = {}) {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'install-hooks-')),
  );
  roots.push(root);

  if (git) execFileSync('git', ['init', '--quiet'], { cwd: root });
  if (hooks) {
    const dir = path.join(root, HOOKS_PATH);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'pre-commit'), '#!/bin/sh\nexit 0\n');
    fs.chmodSync(path.join(dir, 'pre-commit'), mode);
  }

  return root;
}

const hooksPathOf = root => {
  try {
    return execFileSync(
      'git',
      ['config', '--local', '--get', 'core.hooksPath'],
      {
        cwd: root,
        encoding: 'utf8',
      },
    ).trim();
  } catch {
    return null;
  }
};

describe('installHooks', () => {
  it('points core.hooksPath at the tracked hooks directory', () => {
    const root = makeRoot();

    expect(installHooks({ root, logger: silent })).toMatchObject({
      status: 'installed',
    });
    expect(hooksPathOf(root)).toBe(HOOKS_PATH);
  });

  it('is idempotent', () => {
    const root = makeRoot();

    installHooks({ root, logger: silent });
    expect(installHooks({ root, logger: silent })).toMatchObject({
      status: 'already-set',
    });
    expect(hooksPathOf(root)).toBe(HOOKS_PATH);
  });

  // git skips a non-executable hook without a word — the same fail-open shape
  // as the missing-scanner bug this module exists to prevent.
  it('restores the executable bit on a hook that lost it', () => {
    const root = makeRoot({ mode: 0o644 });

    const result = installHooks({ root, logger: silent });

    expect(result.status).toBe('installed');
    expect(result.warnings).toEqual([
      expect.stringContaining('made tools/git/hooks/pre-commit executable'),
    ]);
    expect(() =>
      fs.accessSync(
        path.join(root, HOOKS_PATH, 'pre-commit'),
        fs.constants.X_OK,
      ),
    ).not.toThrow();
  });

  // Once hooksPath is set, anything left in .git/hooks is dead code that looks
  // alive. Saying so is the whole point.
  it('reports a hook left behind in .git/hooks as shadowed', () => {
    const root = makeRoot();
    fs.writeFileSync(
      path.join(root, '.git', 'hooks', 'pre-commit'),
      '#!/bin/sh\nexit 0\n',
    );

    const result = installHooks({ root, logger: silent });

    expect(result.warnings).toEqual([
      expect.stringContaining('.git/hooks still contains pre-commit'),
    ]);
    expect(silent.warn).toHaveBeenCalledWith(
      expect.stringContaining('no longer run'),
    );
  });

  it('ignores the .sample hooks git ships with', () => {
    const root = makeRoot();

    const result = installHooks({ root, logger: silent });

    expect(result.warnings).toEqual([]);
  });

  // A source tarball, or a checkout with no git binary, is a legitimate way to
  // consume this repo. Neither may fail the install.
  it('skips a directory that is not a git working tree', () => {
    const root = makeRoot({ git: false });

    expect(installHooks({ root, logger: silent })).toMatchObject({
      status: 'skipped',
    });
  });

  it('skips when the hooks directory is absent', () => {
    const root = makeRoot({ hooks: false });

    expect(installHooks({ root, logger: silent })).toMatchObject({
      status: 'skipped',
      reason: expect.stringContaining(HOOKS_PATH),
    });
  });
});
