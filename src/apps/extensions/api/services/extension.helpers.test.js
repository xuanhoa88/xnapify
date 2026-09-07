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
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';

import {
  installExtensionDependencies,
  sweepInstallTemps,
  validateManifest,
} from './extension.helpers.js';

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

describe('sweepInstallTemps', () => {
  let tmpDir;
  let extensionsDir;

  const age = async (target, ms) => {
    const when = new Date(Date.now() - ms);
    await fsp.utimes(target, when, when);
  };

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-sweep-'));
    extensionsDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-exts-'));
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
    await fsp.rm(extensionsDir, { recursive: true, force: true });
  });

  it('reclaims abandoned install scratch and spares live ones', async () => {
    // Install and verify clean up in a `finally`, which an OOM kill skips —
    // and nothing else ever revisits these paths.
    const root = path.join(tmpDir, 'xnapify-extension-install');
    await fsp.mkdir(root, { recursive: true });

    const abandoned = path.join(root, 'pkg-abandoned');
    await fsp.mkdir(abandoned);
    await fsp.writeFile(path.join(abandoned, 'big.bin'), 'x');
    await age(abandoned, 7 * 60 * 60_000);

    const live = path.join(root, 'pkg-live');
    await fsp.mkdir(live);

    const removed = await sweepInstallTemps({ tmpDir });

    expect(removed).toBe(1);
    await expect(fsp.access(abandoned)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(fsp.access(live)).resolves.toBeUndefined();
  });

  it('reclaims rollback backups left beside an extension', async () => {
    const stale = path.join(extensionsDir, 'demo.rollback.abc123');
    await fsp.mkdir(stale);
    await age(stale, 7 * 60 * 60_000);

    // The extension itself is old too, and must not be mistaken for scratch.
    const installed = path.join(extensionsDir, 'demo');
    await fsp.mkdir(installed);
    await age(installed, 30 * 24 * 60 * 60_000);

    const removed = await sweepInstallTemps({ tmpDir, extensionsDir });

    expect(removed).toBe(1);
    await expect(fsp.access(stale)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fsp.access(installed)).resolves.toBeUndefined();
  });

  it('reclaims the backups the install path actually creates', async () => {
    // The installer names its backups `.replaced-<pid>-<rand>` (the pre-upgrade
    // swap) and `.failed-<pid>-<rand>` (the rejected install moved aside when
    // Extension.create fails). Neither contains ".rollback.", so the sweep
    // walked straight past both and an OOM kill between the swap and the
    // cleanup stranded a full copy of the extension tree forever.
    const replaced = path.join(extensionsDir, 'demo.replaced-1f-a3b4c5d6');
    const failed = path.join(extensionsDir, 'demo.failed-1f-a3b4c5d6');
    for (const target of [replaced, failed]) {
      await fsp.mkdir(target);
      await age(target, 7 * 60 * 60_000);
    }

    const removed = await sweepInstallTemps({ tmpDir, extensionsDir });

    expect(removed).toBe(2);
    for (const target of [replaced, failed]) {
      await expect(fsp.access(target)).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
  });

  it('reclaims backups inside a scope directory', async () => {
    // Every extension in this repo is scoped (@xnapify-extension/...), so the
    // backup always lands one level down. A non-recursive listing of
    // extensionsDir only ever sees "@xnapify-extension" — which matches no
    // pattern — so in practice the extensionsDir sweep reclaimed nothing at all.
    const scope = path.join(extensionsDir, '@xnapify-extension');
    await fsp.mkdir(scope);

    const stale = path.join(scope, 'docs.replaced-1f-a3b4c5d6');
    await fsp.mkdir(stale);
    await age(stale, 7 * 60 * 60_000);

    const installed = path.join(scope, 'docs');
    await fsp.mkdir(installed);
    await age(installed, 30 * 24 * 60 * 60_000);

    const removed = await sweepInstallTemps({ tmpDir, extensionsDir });

    expect(removed).toBe(1);
    await expect(fsp.access(stale)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fsp.access(installed)).resolves.toBeUndefined();
  });

  it('does nothing when the temp roots have never been created', async () => {
    await expect(sweepInstallTemps({ tmpDir })).resolves.toBe(0);
  });
});

describe('validateManifest name safety', () => {
  const manifestFor = name => ({
    name,
    version: '1.0.0',
    xnapify: { version: '*' },
  });

  // These clear every check the traversal guard makes — no '..', no backslash,
  // and a scoped shape that parses as well formed — but they do not name a
  // leaf. `resolveWithin` is satisfied, because the result really is inside
  // the extensions root: '.' resolves to the root itself and '@scope/.' to an
  // entire scope directory. The installer then renames that path aside as its
  // backup and, on a failed Extension.create, rm -rf's it — so a single
  // uploaded package would take out every installed extension at once.
  it.each(['.', '@xnapify-extension/.', '@xnapify-extension/', '-lead'])(
    'rejects %p, which does not name a leaf directory',
    name => {
      expect(() => validateManifest(manifestFor(name))).toThrow(
        /invalid|not a usable/i,
      );
    },
  );

  it.each([
    'docs',
    'my-ext',
    'ext.name',
    '@xnapify-extension/docs',
    '@xnapify-extension/test-hello-plugin',
  ])('accepts the ordinary name %p', name => {
    expect(validateManifest(manifestFor(name)).name).toBe(name);
  });
});
