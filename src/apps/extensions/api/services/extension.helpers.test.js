/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

import { installExtensionDependencies } from './extension.helpers.js';

const EXTENSIONS_DIR = path.resolve(process.cwd(), 'src', 'extensions');

describe('installExtensionDependencies', () => {
  // jest config sets resetMocks, which wipes implementations set in the
  // jest.mock() factory — re-arm the callback for every test.
  beforeEach(() => {
    execFile.mockImplementation((cmd, args, options, callback) => {
      callback(null, { stdout: '', stderr: '' });
    });
  });

  it('honours a lockfile the extension package shipped', async () => {
    await installExtensionDependencies('/ext/demo', { name: '@acme/demo' });

    const [command, args] = execFile.mock.calls[0];
    expect(command).toBe('npm');
    // '--no-package-lock' made every committed lockfile decorative: production
    // installs re-resolved the declared ranges on every install.
    expect(args).not.toContain('--no-package-lock');
    expect(args).toContain('install');
    expect(args).toContain('--omit=dev');
  });

  it('never runs third-party lifecycle scripts', async () => {
    await installExtensionDependencies('/ext/demo', { name: '@acme/demo' });
    expect(execFile.mock.calls[0][1]).toContain('--ignore-scripts');
  });
});

describe('bundled extension lockfiles', () => {
  const withDeps = fs
    .readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => {
      const manifest = JSON.parse(
        fs.readFileSync(
          path.join(EXTENSIONS_DIR, name, 'package.json'),
          'utf8',
        ),
      );
      return Object.keys(manifest.dependencies || {}).length > 0;
    });

  it('covers at least one extension with dependencies', () => {
    expect(withDeps.length).toBeGreaterThan(0);
  });

  it.each(withDeps)('%s ships a lockfileVersion 3 lockfile', name => {
    const lockPath = path.join(EXTENSIONS_DIR, name, 'package-lock.json');
    expect(fs.existsSync(lockPath)).toBe(true);

    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    // lockfileVersion 1 predates npm 7 and carries no `packages` section, so
    // npm cannot install from it without re-resolving.
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.packages).toBeDefined();
  });

  it.each(withDeps)('%s lockfile matches its manifest dependencies', name => {
    const dir = path.join(EXTENSIONS_DIR, name);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, 'package.json'), 'utf8'),
    );
    const lock = JSON.parse(
      fs.readFileSync(path.join(dir, 'package-lock.json'), 'utf8'),
    );

    // `npm run setup` uses `npm ci` whenever a lockfile exists, and `npm ci`
    // fails outright when the two disagree.
    expect(lock.packages[''].dependencies || {}).toEqual(
      manifest.dependencies || {},
    );
  });
});
