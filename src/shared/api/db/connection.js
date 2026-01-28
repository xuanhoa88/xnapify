/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Sequelize from 'sequelize';
import {
  runMigrations,
  runSeeds,
  revertMigration,
  undoSeed,
  getMigrationStatus,
  getSeedStatus,
} from './migrator';

/**
 * Check if value is a plain object
 * @param {*} item
 * @returns {boolean}
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Deep merge two objects representing Zod schemas or generic objects
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
function merge(target, source) {
  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  const output = { ...target };

  Object.keys(source).forEach(key => {
    if (isObject(source[key])) {
      if (!(key in target)) {
        Object.assign(output, { [key]: source[key] });
      } else {
        output[key] = merge(target[key], source[key]);
      }
    } else {
      Object.assign(output, { [key]: source[key] });
    }
  });

  return output;
}

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
  sequelize.revertMigration = (migrations = null, options = {}) =>
    revertMigration(migrations, sequelize, options);

  /**
   * Undo last seed
   * @param {Array|null} [seeds=null] - Seed source
   * @param {Object} [options] - Optional configuration
   * @returns {Promise<void>}
   */
  sequelize.undoSeed = (seeds = null, options = {}) =>
    undoSeed(seeds, sequelize, options);

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
  let databaseUrl = process.env.RSK_DATABASE_URL || 'sqlite:database.sqlite';
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

  const defaultOptions = {
    // Timezone configuration (defaults to UTC)
    timezone: process.env.RSK_DATABASE_TIMEZONE || '+00:00',
    // Connection pooling for better performance
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    // Logging configuration
    logging: process.env.RSK_DATABASE_LOGGING === 'true' ? console.log : false,
    define: {
      freezeTableName: true,
      timestamps: true,
    },
  };

  // Deep merge options
  const config = merge({}, defaultOptions, options);

  // Create connection and attach migration methods
  const sequelize = new Sequelize(databaseUrl, config);
  return attachMigrationMethods(sequelize);
}

/**
 * Default Sequelize connection instance with migration methods
 */
export const connection = createConnection();
