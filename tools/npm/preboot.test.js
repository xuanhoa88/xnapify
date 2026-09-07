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
import { pathToFileURL } from 'url';

const ROOT = path.resolve(__dirname, '..', '..');
const PREBOOT = path.join(__dirname, 'preboot.js');
const MYSQLD = process.platform === 'win32' ? 'mysqld.exe' : 'mysqld';
const MYSQLADMIN =
  process.platform === 'win32' ? 'mysqladmin.exe' : 'mysqladmin';

/** `ulimit` is a POSIX shell builtin; Windows has no equivalent. */
const itPosix = process.platform === 'win32' ? it.skip : it;

const scratch = [];
const originalDataDir = process.env.XNAPIFY_MYSQL_DATA_DIR;

afterAll(() => {
  scratch.forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
  if (originalDataDir === undefined) delete process.env.XNAPIFY_MYSQL_DATA_DIR;
  else process.env.XNAPIFY_MYSQL_DATA_DIR = originalDataDir;
});

function makeDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  scratch.push(dir);
  return dir;
}

/**
 * Load preboot with MYSQL_DATA_DIR pointed at a throwaway directory. The module
 * reads the variable once, at load, so each case needs a fresh registry.
 *
 * @param {string} [dataDir]
 */
async function loadPreboot(dataDir = makeDir('preboot-mysql-')) {
  process.env.XNAPIFY_MYSQL_DATA_DIR = dataDir;
  jest.resetModules();
  return { dataDir, ...(await import('./preboot.js')) };
}

// ─── .env writes ────────────────────────────────────────────────────────────

describe('upsertEnvVar', () => {
  // Comfortably past the one-block file-size limit the failure case imposes,
  // which the kernel enforces in block-sized steps rather than exactly.
  const ORIGINAL = `${['# xnapify configuration']
    .concat(Array.from({ length: 400 }, (_, i) => `SETTING_${i}=value-${i}`))
    .concat('XNAPIFY_DB_URL=postgres://app:s3cret@db.internal:5432/app')
    .join('\n')}\n`;

  function seedEnv() {
    const root = makeDir('preboot-env-');
    const envPath = path.join(root, '.env');
    fs.writeFileSync(envPath, ORIGINAL);
    return { root, envPath };
  }

  it('replaces the value in place and keeps every other line', async () => {
    const { upsertEnvVar } = await loadPreboot();
    const { envPath } = seedEnv();

    upsertEnvVar(envPath, 'XNAPIFY_DB_URL', 'sqlite:/data/app.sqlite');

    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    expect(lines).toContain('XNAPIFY_DB_URL=sqlite:/data/app.sqlite');
    expect(lines).toContain('SETTING_399=value-399');
    expect(lines).toHaveLength(ORIGINAL.split('\n').length);
  });

  it('creates the file when it does not exist', async () => {
    const { upsertEnvVar } = await loadPreboot();
    const envPath = path.join(makeDir('preboot-env-'), '.env.local');

    upsertEnvVar(envPath, 'XNAPIFY_DB_URL', 'sqlite:/data/app.sqlite');

    expect(fs.readFileSync(envPath, 'utf-8')).toBe(
      'XNAPIFY_DB_URL=sqlite:/data/app.sqlite\n',
    );
  });

  it('writes a value containing a substitution directive verbatim', async () => {
    const { upsertEnvVar } = await loadPreboot();
    const { envPath } = seedEnv();
    const url = 'postgres://app:p$&ss$1word@db.internal:5432/app';

    upsertEnvVar(envPath, 'XNAPIFY_DB_URL', url);

    expect(fs.readFileSync(envPath, 'utf-8')).toContain(
      `XNAPIFY_DB_URL=${url}\n`,
    );
  });

  itPosix('leaves the file intact when the write fails part-way', () => {
    const { root, envPath } = seedEnv();
    const script = path.join(root, 'upsert.mjs');
    fs.writeFileSync(
      script,
      `import { upsertEnvVar } from ${JSON.stringify(PREBOOT)};\n` +
        `upsertEnvVar(${JSON.stringify(envPath)}, 'XNAPIFY_DB_URL', 'sqlite:/data/app.sqlite');\n`,
    );

    // A one-block file-size limit makes the kernel fail the write once it runs
    // past 512 bytes — the same partial failure a full disk produces, without
    // needing a full disk.
    let failure = null;
    try {
      execFileSync(
        '/bin/sh',
        [
          '-c',
          `ulimit -f 1; exec ${JSON.stringify(process.execPath)} ${JSON.stringify(script)}`,
        ],
        { stdio: 'pipe' },
      );
    } catch (err) {
      failure = err;
    }

    // Without this the case passes for the wrong reason: a child that died
    // before writing anything also leaves the file intact.
    expect(failure).not.toBeNull();
    expect(String(failure.stderr)).toContain('EFBIG');

    expect(fs.readFileSync(envPath, 'utf-8')).toBe(ORIGINAL);
    expect(
      fs.readdirSync(root).filter(name => name.startsWith('.env')),
    ).toEqual(['.env']);
  });
});

// ─── MySQL binary installation ──────────────────────────────────────────────

describe('MySQL installation', () => {
  /** A tree as an interrupted extraction leaves it: mysqld present, truncated. */
  function seedInterruptedTree(dataDir, name = 'mysql-8.4.8-interrupted') {
    const dir = path.join(dataDir, name);
    fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'bin', MYSQLD), '\x7fELF truncated');
    return dir;
  }

  /** Fills a staging directory the way a finished extraction would. */
  function extractedTree(dirName) {
    return stageDir => {
      const binDir = path.join(stageDir, dirName, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, MYSQLD), '\x7fELF complete');
    };
  }

  it('does not count an interrupted extraction as installed', async () => {
    const { dataDir, isMysqlInstallComplete } = await loadPreboot();

    expect(isMysqlInstallComplete(seedInterruptedTree(dataDir))).toBe(false);
  });

  it('refuses to resolve a binary out of an interrupted extraction', async () => {
    const { dataDir, resolveMysqlBin } = await loadPreboot();
    seedInterruptedTree(dataDir);

    expect(() => resolveMysqlBin('mysqld')).toThrow(/Could not locate/);
  });

  it('resolves a binary out of a published installation', async () => {
    const { dataDir, installMysqlTree, resolveMysqlBin } = await loadPreboot();
    const basedir = path.join(dataDir, 'mysql-8.4.8-published');

    installMysqlTree(
      basedir,
      'mysql-8.4.8-published',
      extractedTree('mysql-8.4.8-published'),
    );

    expect(resolveMysqlBin('mysqld')).toBe(path.join(basedir, 'bin', MYSQLD));
  });

  it('extracts outside the final location, so a partial tree is never visible', async () => {
    const { dataDir, installMysqlTree } = await loadPreboot();
    const basedir = path.join(dataDir, 'mysql-8.4.8-staged');
    const seen = [];

    installMysqlTree(basedir, 'mysql-8.4.8-staged', stageDir => {
      seen.push(stageDir);
      extractedTree('mysql-8.4.8-staged')(stageDir);
      // The tree is on disk in full, and still invisible at the destination:
      // that is the whole difference between an interrupted install that can
      // be discarded and one that is indistinguishable from a finished one.
      expect(fs.existsSync(basedir)).toBe(false);
    });

    expect(seen[0]).not.toBe(basedir);
    expect(fs.existsSync(path.join(basedir, 'bin', MYSQLD))).toBe(true);
  });

  it('publishes nothing and keeps nothing when the extraction fails', async () => {
    const { dataDir, installMysqlTree, isMysqlInstallComplete } =
      await loadPreboot();
    const basedir = path.join(dataDir, 'mysql-8.4.8-failed');

    expect(() =>
      installMysqlTree(basedir, 'mysql-8.4.8-failed', stageDir => {
        const binDir = path.join(stageDir, 'mysql-8.4.8-failed', 'bin');
        fs.mkdirSync(binDir, { recursive: true });
        fs.writeFileSync(path.join(binDir, MYSQLD), '\x7fELF truncated');
        throw new Error('tar: unexpected end of file');
      }),
    ).toThrow(/unexpected end of file/);

    expect(fs.existsSync(basedir)).toBe(false);
    expect(isMysqlInstallComplete(basedir)).toBe(false);
    expect(fs.readdirSync(dataDir)).toEqual([]);
  });

  it('sweeps abandoned staging directories and spares live ones', async () => {
    const { dataDir, installMysqlTree, sweepMysqlStaging } =
      await loadPreboot();

    // Named by the installer itself, so the sweep is matched against the real
    // naming rather than a guess at it.
    const abandoned = [];
    installMysqlTree(
      path.join(dataDir, 'mysql-8.4.8-abandoned'),
      'mysql-8.4.8-abandoned',
      stageDir => {
        abandoned.push(path.basename(stageDir));
        extractedTree('mysql-8.4.8-abandoned')(stageDir);
      },
    );

    const stale = path.join(dataDir, abandoned[0]);
    const live = path.join(dataDir, `${abandoned[0]}-live`);
    fs.mkdirSync(stale, { recursive: true });
    fs.mkdirSync(live, { recursive: true });
    const longAgo = new Date(Date.now() - 31 * 60_000);
    fs.utimesSync(stale, longAgo, longAgo);

    sweepMysqlStaging();

    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.existsSync(live)).toBe(true);
  });
});

// ─── Concurrent installs ────────────────────────────────────────────────────

describe('MySQL install races', () => {
  afterEach(() => jest.restoreAllMocks());

  /**
   * The sweep is the long pause in an install: it walks abandoned staging
   * trees and deletes them, hundreds of megabytes at a time. Publishing here
   * puts a concurrent preboot's finished installation in place during exactly
   * that pause.
   *
   * @param {object} preboot - Module namespace from {@link loadPreboot}
   * @param {string} basedir - Where the concurrent install publishes
   * @param {string} dirName - Directory the archive unpacks into
   */
  function publishDuringSweep(preboot, basedir, dirName) {
    const realRm = fs.rmSync;
    const realMkdir = fs.mkdirSync;
    const rmSpy = jest.spyOn(fs, 'rmSync');

    rmSpy.mockImplementation((target, options) => {
      if (!path.basename(String(target)).startsWith('stage')) {
        return realRm(target, options);
      }
      rmSpy.mockImplementation(realRm);

      // What the other preboot did: discarded the incomplete tree, then
      // published its own with the real installer.
      realRm(basedir, { recursive: true, force: true });
      preboot.installMysqlTree(basedir, dirName, stageDir => {
        const binDir = path.join(stageDir, dirName, 'bin');
        realMkdir(binDir, { recursive: true });
        fs.writeFileSync(path.join(binDir, MYSQLD), '\x7fELF complete');
      });

      // Armed only now, so the publish above runs unimpeded: from here on, a
      // staging directory means this preboot started a 600 MB download, and a
      // download means it threw the other one's installation away.
      jest.spyOn(fs, 'mkdirSync').mockImplementation((dir, options) => {
        if (path.basename(String(dir)).startsWith('stage')) {
          throw new Error('SENTINEL: discarded and started downloading');
        }
        return realMkdir(dir, options);
      });

      return realRm(target, options);
    });
  }

  it('keeps an installation published while the sweep was running', async () => {
    const preboot = await loadPreboot();
    const { dataDir, ensureMysqlBinaries, isMysqlInstallComplete } = preboot;
    const { dirName } = preboot.getMysqlDownloadInfo();
    const basedir = path.join(dataDir, dirName);

    // An unmarked tree, as an interrupted extraction leaves it: what this
    // preboot sees before the sweep, and the reason it means to discard.
    fs.mkdirSync(path.join(basedir, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(basedir, 'bin', MYSQLD), '\x7fELF truncated');

    // Something for the sweep to delete, so the pause exists at all.
    const abandoned = path.join(dataDir, 'stage-abandoned');
    fs.mkdirSync(abandoned, { recursive: true });
    const longAgo = new Date(Date.now() - 31 * 60_000);
    fs.utimesSync(abandoned, longAgo, longAgo);

    publishDuringSweep(preboot, basedir, dirName);

    await expect(ensureMysqlBinaries()).resolves.toBe(basedir);
    expect(isMysqlInstallComplete(basedir)).toBe(true);
    expect(fs.readFileSync(path.join(basedir, 'bin', MYSQLD), 'utf-8')).toBe(
      '\x7fELF complete',
    );
  });
});

// ─── Binary resolution for the stop path ────────────────────────────────────

describe('resolveMysqlBin', () => {
  /** An installation from before the completion marker existed: whole, unmarked. */
  function seedUnmarkedTree(dataDir, name) {
    const dir = path.join(dataDir, name);
    fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'bin', MYSQLADMIN), '#!/bin/sh\nexit 0\n');
    return path.join(dir, 'bin', MYSQLADMIN);
  }

  it('accepts an unmarked installation only when completeness is not required', async () => {
    const { dataDir, resolveMysqlBin } = await loadPreboot();
    const bin = seedUnmarkedTree(dataDir, 'mysql-8.4.8-legacy');

    // Starting from this tree would exec a possibly truncated mysqld...
    expect(() => resolveMysqlBin('mysqladmin')).toThrow(/Could not locate/);
    // ...but stopping a server already running out of it must still work.
    expect(resolveMysqlBin('mysqladmin', { requireComplete: false })).toBe(bin);
  });

  it('still prefers a complete installation when unmarked ones are accepted', async () => {
    const { dataDir, installMysqlTree, resolveMysqlBin } = await loadPreboot();
    // Sorts before the published tree, so the scan meets it first.
    seedUnmarkedTree(dataDir, 'mysql-8.4.8-legacy');

    const dirName = 'mysql-8.4.8-published';
    const basedir = path.join(dataDir, dirName);
    installMysqlTree(basedir, dirName, stageDir => {
      const binDir = path.join(stageDir, dirName, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, MYSQLD), '\x7fELF complete');
      fs.writeFileSync(path.join(binDir, MYSQLADMIN), '#!/bin/sh\nexit 0\n');
    });

    expect(resolveMysqlBin('mysqladmin', { requireComplete: false })).toBe(
      path.join(basedir, 'bin', MYSQLADMIN),
    );
  });
});

// ─── CLI entry point ────────────────────────────────────────────────────────

describe('CLI dispatch', () => {
  it('runs when node is given this file by a relative path', () => {
    // How the production bundle's prestart invokes it: `node npm/preboot.js`
    // from the bundle root, so argv[1] never matches an absolute filename.
    const out = execFileSync('node', [path.relative(ROOT, PREBOOT), '--help'], {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 60_000,
    });

    expect(out).toMatch(/Usage: node tools\/npm\/preboot\.js/);
  });

  it('runs when node is given this file by an absolute path', () => {
    const out = execFileSync('node', [PREBOOT, '--help'], {
      cwd: os.tmpdir(),
      encoding: 'utf-8',
      timeout: 60_000,
    });

    expect(out).toMatch(/Usage: node tools\/npm\/preboot\.js/);
  });

  it('stays quiet when an unrelated file of the same name imports it', () => {
    // A suffix match on argv[1] cannot tell this apart from the real entry
    // point, and getting it wrong provisions a database on import.
    const dir = makeDir('preboot-entry-');
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ type: 'module' }),
    );
    const shim = path.join(dir, 'preboot.js');
    fs.writeFileSync(
      shim,
      `import { upsertEnvVar } from ${JSON.stringify(pathToFileURL(PREBOOT).href)};\n` +
        `console.log(typeof upsertEnvVar);\n`,
    );

    const out = execFileSync('node', [shim], {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 60_000,
    });

    expect(out.trim()).toBe('function');
  });

  it('still runs once compiled to CommonJS the way the production build ships it', () => {
    // Regression test for a real, shipped bug: `tools/tasks/build.js`
    // bundles this file to CommonJS for `build/npm/preboot.js` (the
    // `prestart` hook `npm start` runs). Rspack cannot give a file
    // concatenated into that bundle its own per-source-file runtime URL, so
    // it replaces `import.meta.url` with a *compile-time* literal of the
    // *source* path instead — permanently the dev machine's checkout, never
    // the deployed file. An `isEntryPoint()` built on that comparison
    // therefore silently never fired in the compiled bundle: no `.env`, no
    // JWT secret, no driver sandbox, on every real deploy. (See
    // `currentFilename`'s own comment in preboot.js for the fix — reading
    // `__filename`, which rspack's `node.__filename: false` config leaves
    // untouched, instead of `import.meta.url`.)
    //
    // None of the other CLI-dispatch tests above catch this: every one of
    // them runs the unbundled ESM source directly, which never exercises
    // rspack's `import.meta.url` rewrite at all. This test bundles
    // preboot.js exactly the way `buildNpmScripts()` does and runs the actual
    // compiled output, so a regression here is the one that matters: a future
    // revert back to `import.meta.url`, or a change to rspack's
    // `node.__filename` handling, would fail it.
    //
    // The bundling step runs in its own `node` process, sharing nothing with
    // jest's module loader, rather than importing `@rspack/core` into this
    // test directly: that package ships ESM that jest's default transform
    // cannot load outside node_modules allowlisting — the same reason
    // tools/tasks/extension.test.js mocks it instead of using the real thing.
    const outDir = makeDir('preboot-bundle-');
    // The driver has to live where Node's own ESM resolution can walk up to
    // the real node_modules — a script under os.tmpdir() (where `outDir`
    // lives) cannot see `@rspack/core` at all.
    const driverDir = fs.mkdtempSync(path.join(ROOT, '.preboot-bundle-'));
    scratch.push(driverDir);
    const driver = path.join(driverDir, 'bundle-and-run.mjs');
    fs.writeFileSync(
      driver,
      `import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { rspack } from '@rspack/core';
import { createRspackConfig } from ${JSON.stringify(pathToFileURL(path.join(__dirname, '..', 'rspack', 'base.config.js')).href)};

const outDir = ${JSON.stringify(outDir)};
const bundleConfig = createRspackConfig('server', {
  entry: { preboot: ${JSON.stringify(PREBOOT)} },
  output: { path: outDir, filename: '[name].js' },
  // Mirrors buildNpmScripts(): npm scripts are plain CJS, no loaders.
  module: {
    rules: [],
    parser: {
      javascript: { requireResolve: false, exprContextCritical: false },
    },
  },
  optimization: {
    minimize: true,
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin({
        compress: { drop_console: false },
      }),
    ],
  },
  devtool: false,
  externals: [
    ({ request }, callback) => {
      if (/^\\.{0,2}[/\\\\]/.test(request)) return callback();
      callback(null, \`commonjs \${request}\`);
    },
  ],
});

await new Promise((resolve, reject) => {
  rspack(bundleConfig, (err, stats) => {
    if (err) return reject(err);
    if (stats.hasErrors()) {
      return reject(new Error(stats.toString({ errorDetails: true })));
    }
    resolve();
  });
});

process.stdout.write(
  execFileSync('node', [path.join(outDir, 'preboot.js'), '--help'], {
    encoding: 'utf-8',
    timeout: 60_000,
  }),
);
`,
    );

    const out = execFileSync('node', [driver], {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 120_000,
    });

    expect(out).toMatch(/Usage: node tools\/npm\/preboot\.js/);
  }, 150_000);
});

// ─── Diagnostics ────────────────────────────────────────────────────────────

describe('tailFile', () => {
  it('returns the last lines of a file', async () => {
    const { tailFile } = await loadPreboot();
    const dir = makeDir('preboot-tail-');
    const file = path.join(dir, 'error.log');
    fs.writeFileSync(
      file,
      Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n'),
    );

    expect(tailFile(file, 3)).toBe('line 47\nline 48\nline 49');
  });

  it('reads only the tail of a file far larger than the window', async () => {
    // error.log has no rotation configured and this runs while mysqld is
    // crash-looping, so reading it whole to keep ten lines is how the
    // diagnostic turns into an allocation error.
    const { tailFile } = await loadPreboot();
    const dir = makeDir('preboot-tail-big-');
    const file = path.join(dir, 'error.log');
    const filler = `${'x'.repeat(999)}\n`.repeat(600); // ~600 KB
    fs.writeFileSync(file, `${filler}the last line`);

    const reads = [];
    const realRead = fs.readSync;
    const spy = jest
      .spyOn(fs, 'readSync')
      .mockImplementation((fd, buffer, offset, length, position) => {
        reads.push(length);
        return realRead(fd, buffer, offset, length, position);
      });

    try {
      expect(tailFile(file, 1)).toBe('the last line');
    } finally {
      spy.mockRestore();
    }

    expect(fs.statSync(file).size).toBeGreaterThan(500_000);
    expect(Math.max(...reads)).toBeLessThanOrEqual(64 * 1024);
  });

  it('explains itself instead of throwing when the file cannot be read', async () => {
    const { tailFile } = await loadPreboot();

    expect(
      tailFile(path.join(makeDir('preboot-tail-missing-'), 'nope.log'), 5),
    ).toMatch(/could not read/);
  });
});
