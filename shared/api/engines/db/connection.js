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

/**
 * Default Sequelize connection options
 */
const DEFAULT_SEQUELIZE_OPTIONS = Object.freeze({
  // Timezone configuration (defaults to UTC)
  timezone: process.env.XNAPIFY_DB_TZ || '+00:00',
  // Connection pooling for better performance
  pool: {
    max: 5,
    min: 0,
    acquire: 30_000,
    idle: 10_000,
  },
  // Logging configuration
  logging: process.env.XNAPIFY_DB_LOG === 'true' ? console.log : false,
  define: {
    freezeTableName: true,
    timestamps: true,
  },
});

/**
 * Attach migration convenience methods to a Sequelize connection instance
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

/**
 * Create a new Sequelize connection instance with migration methods attached
 *
 * @param {string} [url] - Database URL (optional)
 * @param {Object} [options] - Sequelize options
 * @returns {Sequelize} Sequelize connection instance with migration methods
 */
export function createConnection(...args) {
  let databaseUrl = process.env.XNAPIFY_DB_URL || 'sqlite:database.sqlite';
  let options = {};

  // Handle variable arguments
  if (args.length === 1) {
    if (typeof args[0] === 'string') {
      databaseUrl = args[0];
    } else {
      options = args[0];
    }
  } else if (args.length === 2) {
    [databaseUrl, options] = args;
  }

  // Deep merge options
  const config = merge({}, DEFAULT_SEQUELIZE_OPTIONS, options);

  // SQLite does not support custom connection timezones in Sequelize
  if (databaseUrl.startsWith('sqlite:')) {
    delete config.timezone;
  }

  // Create connection and attach migration methods
  const sequelize = new Sequelize(databaseUrl, config);
  return attachMigrationMethods(sequelize);
}

/**
 * Default Sequelize connection instance with migration methods
 */
export const connection = createConnection();
