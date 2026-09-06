/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

import merge from 'lodash/merge';
import Sequelize from 'sequelize';

import { getDataDir } from '@shared/utils/env.js';
import { getHmrState } from '@shared/utils/hmrState.js';

import { register } from '../../shutdown.js';

import {
  detectDialect,
  getDriverModulePath,
  normalizeDatabaseUrl,
  registerDriverPaths,
} from './drivers.js';
import {
  runMigrations,
  runSeeds,
  revertMigrations,
  undoSeeds,
  getMigrationStatus,
  getSeedStatus,
} from './migrator.js';

// ======================================================================
// Constants
// ======================================================================

// SQLite performance tuning PRAGMAs (applied per-connection via afterConnect)
const SQLITE_PRAGMAS = [
  'PRAGMA journal_mode = WAL', // concurrent readers + single writer
  'PRAGMA busy_timeout = 5000', // wait 5 s on lock instead of failing
  'PRAGMA synchronous = NORMAL', // safe with WAL, less fsync overhead
  'PRAGMA cache_size = -64000', // 64 MB page cache
  'PRAGMA foreign_keys = ON', // enforce FK constraints
  'PRAGMA mmap_size = 268435456', // 256 MB memory-mapped I/O
];

/**
 * Promisified PRAGMA execution on a raw sqlite3 driver connection.
 *
 * @param {object} connection - Raw sqlite3.Database handle from the pool
 * @param {string} sql        - PRAGMA statement to execute
 * @returns {Promise<void>}
 */
function runSqlitePragma(connection, sql) {
  return new Promise((resolve, reject) => {
    connection.run(sql, err => (err ? reject(err) : resolve()));
  });
}

/**
 * Build default Sequelize options.
 * Returns a fresh object each call to prevent cross-connection mutation.
 *
 * @returns {Object} Default Sequelize configuration
 */
function getDefaultOptions() {
  return {
    // Timezone configuration (defaults to UTC)
    timezone: process.env.XNAPIFY_DB_TZ || '+00:00',
    // Connection pool — configurable via env vars
    pool: {
      max: parseInt(process.env.XNAPIFY_DB_POOL_MAX, 10) || 5,
      min: parseInt(process.env.XNAPIFY_DB_POOL_MIN, 10) || 0,
      acquire: 30_000,
      idle: 10_000,
    },
    // Logging — disabled in production even if XNAPIFY_DB_LOG is set
    logging:
      process.env.XNAPIFY_DB_LOG === 'true' &&
      process.env.NODE_ENV !== 'production'
        ? console.log
        : false,
    define: {
      freezeTableName: true,
      timestamps: true,
    },
  };
}

// ======================================================================
// Migration method attachment
// ======================================================================

/**
 * Attach migration convenience methods to a Sequelize connection instance.
 *
 * Intentional instance extension — method names are prefixed to avoid
 * collision with Sequelize's own API surface.
 *
 * @param {Sequelize} sequelize - Sequelize connection instance
 * @returns {Sequelize} Enhanced connection with migration methods
 */
function attachMigrationMethods(sequelize) {
  /**
   * Run pending migrations
   * @param {Array} migrations - Migration sources from modules
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<void>}
   */
  sequelize.runMigrations = (migrations, options = {}) =>
    runMigrations(migrations, sequelize, options);

  /**
   * Run seeds
   * @param {Array} seeds - Seed sources from modules
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<void>}
   */
  sequelize.runSeeds = (seeds, options = {}) =>
    runSeeds(seeds, sequelize, options);

  /**
   * Revert last migration
   * @param {Array} migrations - Migration sources from modules
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<void>}
   */
  sequelize.revertMigrations = (migrations, options = {}) =>
    revertMigrations(migrations, sequelize, options);

  /**
   * Undo last seed
   * @param {Array} seeds - Seed sources from modules
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<void>}
   */
  sequelize.undoSeeds = (seeds, options = {}) =>
    undoSeeds(seeds, sequelize, options);

  /**
   * Get migration status
   * @param {Array} migrations - Migration sources from modules
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<{executed: Array, pending: Array}>}
   */
  sequelize.getMigrationStatus = (migrations, options = {}) =>
    getMigrationStatus(migrations, sequelize, options);

  /**
   * Get seed status
   * @param {Array} seeds - Seed sources from modules
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<{executed: Array, pending: Array}>}
   */
  sequelize.getSeedStatus = (seeds, options = {}) =>
    getSeedStatus(seeds, sequelize, options);

  return sequelize;
}

// ======================================================================
// Public API
// ======================================================================

/**
 * Create a new Sequelize connection instance with migration methods attached
 *
 * @param {string} [url] - Database URL (optional, defaults to XNAPIFY_DB_URL)
 * @param {Object} [options] - Sequelize options (deep-merged with defaults)
 * @returns {Sequelize} Sequelize connection instance with migration methods
 */
export function createConnection(url, options) {
  let databaseUrl = process.env.XNAPIFY_DB_URL || 'sqlite:database.sqlite';
  let opts = {};

  // Handle overloaded arguments: (url), (options), or (url, options)
  if (typeof url === 'string') {
    databaseUrl = url;
    opts = options && typeof options === 'object' ? options : {};
  } else if (url && typeof url === 'object') {
    opts = url;
  }

  // Deep merge with fresh defaults
  const config = merge({}, getDefaultOptions(), opts);

  // `mariadb:` is an alias for the mysql dialect: mysql2 is the only MySQL
  // family driver provisioned, and it speaks the MariaDB protocol. Left as
  // `mariadb:` Sequelize would select its `mariadb` dialect and demand the
  // `mariadb` package, which is never installed. A caller that pins
  // `dialect` explicitly is left alone — it brought its own driver.
  if (!config.dialect) {
    databaseUrl = normalizeDatabaseUrl(databaseUrl);
  }

  // SQLite-specific tuning
  const SQLITE_PREFIX = 'sqlite:';
  if (databaseUrl.startsWith(SQLITE_PREFIX)) {
    // Resolve relative SQLite paths against XNAPIFY_SQLITE_DATA_DIR when set.
    // This mirrors how PG_DATA_DIR and MYSQL_DATA_DIR control data placement.
    const filePath = databaseUrl.slice(SQLITE_PREFIX.length) || ':memory:';

    // Leave in-memory and explicit absolute paths completely untouched
    if (filePath !== ':memory:' && !path.isAbsolute(filePath)) {
      // Safely resolve the data dir with a development fallback
      let dataDir = process.env.XNAPIFY_SQLITE_DATA_DIR
        ? path.resolve(process.env.XNAPIFY_SQLITE_DATA_DIR)
        : getDataDir('sqlite');

      // Create data directory if it doesn't exist
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Safe to use basename here to prevent redundant paths
      // like `.xnapify/sqlite/database.sqlite` since absolute paths are out
      databaseUrl = `${SQLITE_PREFIX}${path.join(dataDir, path.basename(filePath))}`;
    }

    delete config.timezone; // SQLite ignores connection timezones

    // Apply WAL mode and performance PRAGMAs on every new pool connection
    config.hooks = {
      ...config.hooks,
      afterConnect: async connection => {
        for (const pragma of SQLITE_PRAGMAS) {
          await runSqlitePragma(connection, pragma);
        }
      },
    };
  }

  // Dev HMR: reuse connection across hot reloads to prevent teardown gaps.
  // Cache is keyed by the fully-resolved database URL so that
  // createConnection('postgres://other') correctly returns a separate
  // instance instead of the default singleton.
  if (__DEV__) {
    const cache = getHmrState('db:connections', () => new Map());
    const cached = cache.get(databaseUrl);
    if (cached) {
      // Reset both model registries so HMR re-registers fresh classes.
      // - sequelize.models: dict used by include/association resolution
      // - modelManager.models: array that grows on every define() call;
      //   clearing it prevents a slow memory leak across reloads.
      cached.models = {};
      cached.modelManager.models = [];
      return attachMigrationMethods(cached);
    }
  }

  // Drivers live in .xnapify/sequelize-drivers/<dialect>, never in
  // node_modules (npm prunes unmanaged entries on every reify). Expose the
  // sandboxes to require() and point Sequelize at the dialect module directly.
  registerDriverPaths();
  if (!config.dialectModule && !config.dialectModulePath) {
    const driverPath = getDriverModulePath(detectDialect(databaseUrl));
    if (driverPath) config.dialectModulePath = driverPath;
  }

  // Create connection and attach migration methods
  const sequelize = new Sequelize(databaseUrl, config);

  // Store in dev HMR cache
  if (__DEV__) {
    getHmrState('db:connections', () => new Map()).set(databaseUrl, sequelize);
  }

  return attachMigrationMethods(sequelize);
}

/**
 * Close and drain the connection pool.
 * Call during graceful shutdown (SIGTERM/SIGINT) to release file locks (SQLite)
 * and drain TCP connections (PostgreSQL/MySQL).
 *
 * @returns {Promise<void>}
 */
export async function closeConnection() {
  if (__DEV__) {
    // In development, the DB connection is cached globally and shared across HMR reloads.
    // We do NOT close it here, allowing in-flight requests on the old bundle to complete safely
    // using the exact same underlying connection pool that the new bundle will pick up.
    return;
  }

  if (connection && typeof connection.close === 'function') {
    await connection.close();
    console.log('[DB] Connection closed successfully.');
  }
}

/**
 * Default Sequelize connection instance with migration methods
 */
export const connection = createConnection();

// Register with centralized shutdown coordinator
register('db', () => closeConnection());
