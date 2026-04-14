/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import merge from 'lodash/merge';
import Sequelize from 'sequelize';

import {
  runMigrations,
  runSeeds,
  revertMigrations,
  undoSeeds,
  getMigrationStatus,
  getSeedStatus,
} from './migrator';

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

  // SQLite-specific tuning
  const SQLITE_PREFIX = 'sqlite:';
  if (databaseUrl.startsWith(SQLITE_PREFIX)) {
    // Resolve relative SQLite paths against XNAPIFY_SQLITE_DATA_DIR when set.
    // This mirrors how PG_DATA_DIR and MYSQL_DATA_DIR control data placement.
    const filePath = databaseUrl.slice(SQLITE_PREFIX.length);

    // Leave in-memory and explicit absolute paths completely untouched
    if (filePath !== ':memory:' && !path.isAbsolute(filePath)) {
      // Safely resolve the data dir with a development fallback
      let dataDir = process.env.XNAPIFY_SQLITE_DATA_DIR;
      if (!dataDir) {
        dataDir = path.join(
          process.env.NODE_ENV === 'production' ? os.homedir() : process.cwd(),
          '.xnapify',
          'sqlite',
        );
      }

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

  // Create connection and attach migration methods
  const sequelize = new Sequelize(databaseUrl, config);
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
  if (connection) {
    await connection.close();
  }
}

/**
 * Default Sequelize connection instance with migration methods
 */
export const connection = createConnection();
