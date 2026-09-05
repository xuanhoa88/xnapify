/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import Module from 'module';
import path from 'path';

/**
 * On-demand database drivers are installed by `tools/npm/preboot.js` into an
 * isolated sandbox per dialect:
 *
 *   <root>/.xnapify/sequelize-drivers/<dialect>/node_modules/<package>
 *
 * They are deliberately NOT linked into the project's `node_modules`. npm
 * prunes anything it does not own from `node_modules` on every reify
 * (`npm install <pkg>`, `npm ci`, `npm update`, …), so a link there is a
 * time bomb. Instead the server resolves drivers straight from the sandbox:
 *
 * - `registerDriverPaths()` puts the sandbox `node_modules` dirs on
 *   `NODE_PATH` so Sequelize's own `require('pg-hstore')`-style calls resolve.
 * - `getDriverModulePath()` gives Sequelize an explicit `dialectModulePath`.
 */

/** Sandbox root, relative to the project root. */
export const DRIVER_SANDBOX_DIR = path.join('.xnapify', 'sequelize-drivers');

/** Sequelize dialect → npm package that implements it. */
export const DIALECT_DRIVERS = Object.freeze({
  sqlite: 'sqlite3',
  postgres: 'pg',
  mysql: 'mysql2',
});

const SANDBOXED_DIALECTS = Object.keys(DIALECT_DRIVERS);

/**
 * Detect the Sequelize dialect from a database URL or shorthand.
 *
 * @param {string} [url]
 * @returns {'sqlite'|'postgres'|'mysql'|'mariadb'}
 */
export function detectDialect(url = '') {
  const value = String(url).trim().toLowerCase();
  if (/^postgres(ql)?(:|$)/.test(value)) return 'postgres';
  if (/^mysql(:|$)/.test(value)) return 'mysql';
  if (/^mariadb(:|$)/.test(value)) return 'mariadb';
  return 'sqlite';
}

/**
 * `node_modules` directory of a dialect's driver sandbox.
 *
 * @param {string} dialect
 * @param {string} [root=process.cwd()]
 * @returns {string}
 */
export function getDriverModulesDir(dialect, root = process.cwd()) {
  return path.join(root, DRIVER_SANDBOX_DIR, dialect, 'node_modules');
}

/**
 * Absolute path of the installed driver package for a dialect, or null when
 * the sandbox does not hold it (Sequelize then falls back to normal
 * resolution, which covers drivers declared in package.json).
 *
 * @param {string} dialect
 * @param {string} [root=process.cwd()]
 * @returns {string|null}
 */
export function getDriverModulePath(dialect, root = process.cwd()) {
  const name = DIALECT_DRIVERS[dialect];
  if (!name) return null;
  const dir = path.join(getDriverModulesDir(dialect, root), name);
  return fs.existsSync(path.join(dir, 'package.json')) ? dir : null;
}

/**
 * Make every existing driver sandbox resolvable by plain `require()` for the
 * rest of this process. Idempotent — safe to call on every connection.
 *
 * @param {string} [root=process.cwd()]
 * @returns {string[]} Sandbox directories now on the lookup path
 */
export function registerDriverPaths(root = process.cwd()) {
  const dirs = SANDBOXED_DIALECTS.map(d => getDriverModulesDir(d, root)).filter(
    d => fs.existsSync(d),
  );

  const current = (process.env.NODE_PATH || '')
    .split(path.delimiter)
    .filter(Boolean);
  const missing = dirs.filter(d => !current.includes(d));
  if (missing.length === 0) return dirs;

  process.env.NODE_PATH = [...current, ...missing].join(path.delimiter);
  // Re-derive Module.globalPaths from NODE_PATH so requires issued from
  // inside node_modules (Sequelize → pg-hstore) see the sandboxes too.
  // eslint-disable-next-line no-underscore-dangle
  if (typeof Module._initPaths === 'function') {
    // eslint-disable-next-line no-underscore-dangle
    Module._initPaths();
  }
  return dirs;
}
