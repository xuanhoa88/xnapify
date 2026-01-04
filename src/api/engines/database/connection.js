/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Sequelize from 'sequelize';

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
 * Create a new Sequelize connection instance
 *
 * @param {string} [url] - Database URL (optional)
 * @param {Object} [options] - Sequelize options
 * @returns {Sequelize} Sequelize connection instance
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
    // Connection pooling for better performance
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    // Logging configuration
    logging: process.env.RSK_DATABASE_LOGGING === 'true' ? console.log : false,
    // Disable operatorsAliases for security (prevents string-based operator injection)
    operatorsAliases: false,
    define: {
      freezeTableName: true,
      timestamps: true,
    },
  };

  // Deep merge options
  const config = merge({}, defaultOptions, options);

  return new Sequelize(databaseUrl, config);
}

/**
 * Default Sequelize connection instance
 */
export const connection = createConnection();
