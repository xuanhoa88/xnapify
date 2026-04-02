/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

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

const DEFAULT_DB_URL = 'sqlite:database.sqlite';
const SQLITE_PREFIX = 'sqlite:';

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
   * @param {Array|null} [migrations=null] - Migration source
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<void>}
   */
  sequelize.runMigrations = (migrations = null, options = {}) =>
    runMigrations(migrations, sequelize, options);

  /**
   * Run seeds
   * @param {Array|null} [seeds=null] - Seed source
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<void>}
   */
  sequelize.runSeeds = (seeds = null, options = {}) =>
    runSeeds(seeds, sequelize, options);

  /**
   * Revert last migration
   * @param {Array|null} [migrations=null] - Migration source
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<void>}
   */
  sequelize.revertMigrations = (migrations = null, options = {}) =>
    revertMigrations(migrations, sequelize, options);

  /**
   * Undo last seed
   * @param {Array|null} [seeds=null] - Seed source
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<void>}
   */
  sequelize.undoSeeds = (seeds = null, options = {}) =>
    undoSeeds(seeds, sequelize, options);

  /**
   * Get migration status
   * @param {Array|null} [migrations=null] - Migration source
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<{executed: Array, pending: Array}>}
   */
  sequelize.getMigrationStatus = (migrations = null, options = {}) =>
    getMigrationStatus(migrations, sequelize, options);

  /**
   * Get seed status
   * @param {Array|null} [seeds=null] - Seed source
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<{executed: Array, pending: Array}>}
   */
  sequelize.getSeedStatus = (seeds = null, options = {}) =>
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
  let databaseUrl = process.env.XNAPIFY_DB_URL || DEFAULT_DB_URL;
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

  // SQLite does not support custom connection timezones in Sequelize
  if (databaseUrl.startsWith(SQLITE_PREFIX)) {
    delete config.timezone;
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
