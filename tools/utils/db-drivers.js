/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import Module from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

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

/** Sandbox root, relative to the application root. */
export const DRIVER_SANDBOX_DIR = path.join('.xnapify', 'sequelize-drivers');

/** Sequelize dialect → npm package that implements it. */
export const DIALECT_DRIVERS = Object.freeze({
  sqlite: 'sqlite3',
  postgres: 'pg',
  mysql: 'mysql2',
});

/**
 * URL scheme (or bare shorthand) → Sequelize dialect.
 *
 * This is the ONE place a database URL is mapped to a dialect. `env.js` and
 * `tools/npm/preboot.js` both import from here so validation, provisioning
 * and connection can never disagree.
 *
 * MariaDB is deliberately aliased onto the `mysql` dialect: the only MySQL
 * family driver xnapify ships is `mysql2`, which speaks the MariaDB wire
 * protocol, and preboot's `__system_mariadb__` path provisions a MariaDB
 * *server* behind it. Sequelize's separate `mariadb` dialect needs the
 * `mariadb` package, which is never installed — see `normalizeDatabaseUrl`.
 */
export const DIALECT_SCHEMES = Object.freeze({
  sqlite: 'sqlite',
  postgres: 'postgres',
  postgresql: 'postgres',
  mysql: 'mysql',
  mariadb: 'mysql',
});

const SANDBOXED_DIALECTS = Object.keys(DIALECT_DRIVERS);

/**
 * Dialect of a database URL or shorthand, or null when the scheme is not one
 * xnapify supports. Use this to *validate*; use `detectDialect` to pick a
 * driver with the SQLite fallback applied.
 *
 * @param {string} [url]
 * @returns {'sqlite'|'postgres'|'mysql'|null}
 */
export function parseDialect(url = '') {
  const scheme = String(url).trim().toLowerCase().split(':', 1)[0];
  return DIALECT_SCHEMES[scheme] ?? null;
}

/**
 * Detect the Sequelize dialect from a database URL or shorthand, defaulting
 * to SQLite (the dialect `createConnection()` also falls back to).
 *
 * @param {string} [url]
 * @returns {'sqlite'|'postgres'|'mysql'}
 */
export function detectDialect(url = '') {
  return parseDialect(url) ?? 'sqlite';
}

/**
 * Rewrite a `mariadb:` URL onto the `mysql:` scheme so Sequelize selects the
 * mysql dialect (backed by the `mysql2` driver we actually install) instead
 * of its `mariadb` dialect, whose driver package is never provisioned.
 * Every other URL is returned untouched.
 *
 * @param {string} [url]
 * @returns {string}
 */
export function normalizeDatabaseUrl(url = '') {
  const value = String(url);
  return /^mariadb:/i.test(value.trim())
    ? value.replace(/^(\s*)mariadb:/i, '$1mysql:')
    : value;
}

/**
 * Directory the driver sandboxes live under.
 *
 * `tools/npm/preboot.js` installs them relative to the application root, and
 * the server must find the same tree no matter which working directory it was
 * started from (a systemd unit with an unrelated `WorkingDirectory`, or
 * `node /app/build/server.js` from `/`). So the root is derived from this
 * module's own location — the nearest ancestor holding a `package.json` — and
 * `process.cwd()` is only a fallback for when that cannot be determined.
 *
 * @param {string} [from] - Directory to start the upward walk from
 * @returns {string}
 */
export function resolveSandboxRoot(from = moduleDir()) {
  const candidates = [];

  const bundleRoot = from ? findPackageRoot(from) : null;
  if (bundleRoot) candidates.push(bundleRoot);
  candidates.push(process.cwd());

  // Prefer a root that already holds a provisioned sandbox, so an existing
  // cwd-relative installation keeps resolving after this change.
  const provisioned = candidates.find(root =>
    fs.existsSync(path.join(root, DRIVER_SANDBOX_DIR)),
  );
  return provisioned || candidates[0];
}

/** Directory of this module — CJS/bundled first, then native ESM. */
function moduleDir() {
  if (typeof __dirname === 'string') return __dirname;
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return null;
  }
}

/** Nearest ancestor of `dir` containing a package.json, or null. */
function findPackageRoot(dir) {
  let current = path.resolve(dir);
  for (;;) {
    if (fs.existsSync(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * `node_modules` directory of a dialect's driver sandbox.
 *
 * @param {string} dialect
 * @param {string} [root=resolveSandboxRoot()]
 * @returns {string}
 */
export function getDriverModulesDir(dialect, root = resolveSandboxRoot()) {
  return path.join(root, DRIVER_SANDBOX_DIR, dialect, 'node_modules');
}

/**
 * Absolute path of the installed driver package for a dialect, or null when
 * the sandbox does not hold it (Sequelize then falls back to normal
 * resolution, which covers drivers declared in package.json).
 *
 * @param {string} dialect
 * @param {string} [root=resolveSandboxRoot()]
 * @returns {string|null}
 */
export function getDriverModulePath(dialect, root = resolveSandboxRoot()) {
  const name = DIALECT_DRIVERS[dialect];
  if (!name) return null;
  const dir = path.join(getDriverModulesDir(dialect, root), name);
  return fs.existsSync(path.join(dir, 'package.json')) ? dir : null;
}

/**
 * Make every existing driver sandbox resolvable by plain `require()` for the
 * rest of this process. Idempotent — safe to call on every connection.
 *
 * @param {string} [root=resolveSandboxRoot()]
 * @returns {string[]} Sandbox directories now on the lookup path
 */
export function registerDriverPaths(root = resolveSandboxRoot()) {
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
