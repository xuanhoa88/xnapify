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
import { fileURLToPath, pathToFileURL } from 'url';

import {
  DRIVER_SANDBOX_DIR,
  detectDialect,
  getDriverModulePath,
  getDriverModulesDir,
  normalizeDatabaseUrl,
  parseDialect,
  resolveSandboxRoot,
} from './drivers.js';

const DRIVERS_MODULE = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'drivers.js'),
).href;

/**
 * Run an ESM snippet in a real Node process. Jest replaces the `module` core
 * module with its own registry, so NODE_PATH registration can only be
 * observed outside the Jest sandbox.
 */
function runInNode(script, cwd) {
  return execFileSync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    { cwd, encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } },
  ).trim();
}

describe('db driver sandbox resolution', () => {
  let root;

  const fakePackage = (dialect, name) => {
    const dir = path.join(getDriverModulesDir(dialect, root), name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name, main: 'index.js' }),
    );
    fs.writeFileSync(
      path.join(dir, 'index.js'),
      `module.exports = { name: '${name}' };`,
    );
    return dir;
  };

  beforeEach(() => {
    // realpath: macOS tmpdir is a symlink and child processes report the
    // resolved cwd, which must match the paths we compute here.
    root = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'xnapify-drivers-')),
    );
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('detects the dialect from full URLs and shorthands', () => {
    expect(detectDialect('postgres')).toBe('postgres');
    expect(detectDialect('postgresql://u:p@h:5432/db')).toBe('postgres');
    expect(detectDialect('mysql://u:p@h/db')).toBe('mysql');
    // MariaDB is served by the mysql dialect — mysql2 is the only MySQL
    // family driver ever installed.
    expect(detectDialect('mariadb://u:p@h/db')).toBe('mysql');
    expect(detectDialect('sqlite:database.sqlite')).toBe('sqlite');
    expect(detectDialect('')).toBe('sqlite');
  });

  it('always resolves a driver package for every dialect it can return', () => {
    // Regression: detectDialect('mariadb://…') used to return a dialect that
    // DIALECT_DRIVERS had no entry for, so getDriverModulePath() returned null
    // and boot died with "install pg/mysql2 manually".
    for (const url of [
      'sqlite:db.sqlite',
      'postgres',
      'postgresql',
      'postgresql://u:p@h/db',
      'mysql://u:p@h/db',
      'mariadb://u:p@h/db',
    ]) {
      const dialect = detectDialect(url);
      fakePackage(
        dialect,
        { sqlite: 'sqlite3', postgres: 'pg', mysql: 'mysql2' }[dialect],
      );
      expect(getDriverModulePath(dialect, root)).not.toBeNull();
    }
  });

  it('separates validation from the sqlite fallback', () => {
    expect(parseDialect('postgresql')).toBe('postgres');
    expect(parseDialect('mariadb://u@h/db')).toBe('mysql');
    // Unknown schemes are rejected here even though detectDialect defaults
    // them to sqlite — this is what shared/config/env.js validates with.
    expect(parseDialect('mongodb://u@h/db')).toBeNull();
    expect(parseDialect('')).toBeNull();
    expect(detectDialect('mongodb://u@h/db')).toBe('sqlite');
  });

  it('rewrites mariadb: URLs onto the mysql dialect', () => {
    expect(normalizeDatabaseUrl('mariadb://u:p@h:3306/db')).toBe(
      'mysql://u:p@h:3306/db',
    );
    expect(normalizeDatabaseUrl('MariaDB://h/db')).toBe('mysql://h/db');
    expect(normalizeDatabaseUrl('postgres://h/db')).toBe('postgres://h/db');
    expect(normalizeDatabaseUrl('sqlite:db.sqlite')).toBe('sqlite:db.sqlite');
  });

  it('derives the sandbox root from the module location, not the cwd', () => {
    // Regression: starting the server from an unrelated working directory
    // (systemd WorkingDirectory, `node /app/build/server.js` from /) made
    // every driver lookup miss.
    const appRoot = path.join(root, 'app');
    const nested = path.join(appRoot, 'build', 'chunks');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(appRoot, 'package.json'), '{"name":"app"}');
    fs.mkdirSync(path.join(appRoot, DRIVER_SANDBOX_DIR), { recursive: true });

    expect(resolveSandboxRoot(nested)).toBe(appRoot);
    expect(resolveSandboxRoot(nested)).not.toBe(process.cwd());
  });

  it('returns the sandbox package dir only when it is installed', () => {
    expect(getDriverModulePath('postgres', root)).toBeNull();
    const dir = fakePackage('postgres', 'pg');
    expect(getDriverModulePath('postgres', root)).toBe(dir);
    expect(getDriverModulePath('mariadb', root)).toBeNull();
  });

  it('registers existing sandboxes on NODE_PATH exactly once', () => {
    fakePackage('postgres', 'pg');
    const expected = getDriverModulesDir('postgres', root);

    const out = runInNode(
      `
      import Module from 'module';
      import path from 'path';
      const { registerDriverPaths } = await import(${JSON.stringify(DRIVERS_MODULE)});
      const first = registerDriverPaths(process.cwd());
      registerDriverPaths(process.cwd());
      const entries = process.env.NODE_PATH.split(path.delimiter);
      console.log(JSON.stringify({
        first,
        occurrences: entries.filter(e => e === ${JSON.stringify(expected)}).length,
        inGlobalPaths: Module.globalPaths.includes(${JSON.stringify(expected)}),
      }));
      `,
      root,
    );

    expect(JSON.parse(out)).toEqual({
      first: [expected],
      occurrences: 1,
      inGlobalPaths: true,
    });
  });

  it('makes sandbox packages resolvable from anywhere, including node_modules', () => {
    fakePackage('postgres', 'pg-hstore');

    const out = runInNode(
      `
      import { createRequire } from 'module';
      import path from 'path';
      const { registerDriverPaths } = await import(${JSON.stringify(DRIVERS_MODULE)});
      const before = (() => {
        try { createRequire(path.join(process.cwd(), 'server.js'))('pg-hstore'); return 'found'; }
        catch (e) { return e.code; }
      })();
      registerDriverPaths(process.cwd());
      const fromProject = createRequire(path.join(process.cwd(), 'server.js'))('pg-hstore').name;
      const fromDependency = createRequire(
        path.join(process.cwd(), 'node_modules', 'sequelize', 'lib', 'sequelize.js'),
      )('pg-hstore').name;
      console.log(JSON.stringify({ before, fromProject, fromDependency }));
      `,
      root,
    );

    expect(JSON.parse(out)).toEqual({
      before: 'MODULE_NOT_FOUND',
      fromProject: 'pg-hstore',
      fromDependency: 'pg-hstore',
    });
  });
});
