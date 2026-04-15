/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const path = require('path');

const glob = require('glob');
const SequelizeModule = require('sequelize');

const config = require('../config');

// -----------------------------------------------------------------------------
// Test database helpers
// -----------------------------------------------------------------------------
const { Sequelize } = SequelizeModule;

// Constants for test database setup
const MODEL_GLOB_PATTERN = '**/apps/**/api/models/*.js';
const INDEX_FILE_NAME = 'index.js';
const SEQUELIZE_CONFIG = {
  logging: false, // Turn off logging for tests
  define: {
    freezeTableName: true,
    timestamps: true,
  },
  dialectOptions: {
    timeout: 30000, // 30 second timeout for slow test queries
  },
};

// Get all model files
const modelFiles = glob.sync(path.join(config.CWD, MODEL_GLOB_PATTERN));

/**
 * Loads all model definition files and initializes them.
 * @param {Object} context - Context object for model factories
 * @returns {Promise<Object>} Dictionary of initialized models
 * @throws {Error} If model loading or initialization fails
 */
function loadModels(context) {
  const loadedModels = {};

  if (modelFiles.length === 0) {
    throw new Error(
      `No model files found matching pattern: ${MODEL_GLOB_PATTERN}`,
    );
  }

  for (const file of modelFiles) {
    // Skip index files - they're usually for barrel exports
    if (file.endsWith(INDEX_FILE_NAME)) {
      continue;
    }

    try {
      // Import model file
      const { default: initModel } = require(file);

      // Validate that the export is a function
      if (typeof initModel !== 'function') {
        console.warn(`Skipping non-function export in ${file}`);
        continue;
      }

      // Initialize the model
      const model = initModel(context);

      // Validate that the model has required properties
      if (!model || !model.name) {
        throw new Error(`Model must have a 'name' property`);
      }

      loadedModels[model.name] = model;
    } catch (err) {
      throw new Error(`Failed to load model from ${file}: ${err.message}`);
    }
  }

  return loadedModels;
}

/**
 * Sets up model associations after all models are loaded.
 * @param {Object} models - Dictionary of initialized models
 * @throws {Error} If association setup fails
 */
function setupAssociations(models) {
  Object.values(models).forEach(model => {
    if (typeof model.associate === 'function') {
      try {
        model.associate(models);
      } catch (err) {
        console.error(`Association error in model ${model.name}:`, err);
        throw err;
      }
    }
  });
}

/**
 * Bootstraps an in-memory SQLite database populated with all application models.
 * Creates a fresh instance each time to ensure test isolation.
 *
 * @returns {Promise<{sequelize: Sequelize, models: Object}>} Database instance and models
 * @throws {Error} If database initialization fails
 *
 * @example
 * const { sequelize, models } = await setupTestDb();
 * const user = await models.User.create({ ... });
 * // ... run tests
 * await closeTestDb();
 */
async function setupTestDb() {
  let sequelizeInstance;
  let models;

  try {
    // Create fresh Sequelize instance for test isolation
    sequelizeInstance = new Sequelize('sqlite::memory:', SEQUELIZE_CONFIG);

    const context = {
      ...SequelizeModule,
      DataTypes: SequelizeModule.DataTypes,
      connection: sequelizeInstance,
    };

    const origDefine = sequelizeInstance.define;
    sequelizeInstance.define = function (modelName, attributes, options) {
      if (attributes) {
        Object.keys(attributes).forEach(key => {
          const attr = attributes[key];

          // Sequelize SQLite Query generator permanently suppresses Explicit IDs mapped on UUID columns
          // if their original defaultValue implies native database generation.
          // Changing it to a static string placeholder completely breaks this suppression,
          // forcing Sequelize to safely bind the column in SQL statements!
          if (attr && attr.type && attr.type.key === 'UUID') {
            attr.type = SequelizeModule.DataTypes.STRING(36);
            attr.defaultValue = 'sqlite-mock-uuid-fallback';
          }
        });
      }
      return origDefine.call(this, modelName, attributes, options);
    };

    // Now securely assign dynamic unique JavaScript strings automatically.
    // Because the defaultValue is a static placeholder, Sequelize safely transports this overridden property
    // natively into the bind parameter array and returns it identically on model instantiation.
    sequelizeInstance.addHook('beforeValidate', instance => {
      if (instance.isNewRecord) {
        const crypto = require('crypto');
        const pks = Object.keys(instance.rawAttributes).filter(
          key =>
            instance.rawAttributes[key].primaryKey &&
            instance.rawAttributes[key].type.key === 'STRING',
        );
        pks.forEach(pk => {
          // If it's missing or equals our generic fallback, uniquely generate it natively.
          if (
            !instance.dataValues[pk] ||
            instance.dataValues[pk] === 'sqlite-mock-uuid-fallback'
          ) {
            instance.set(pk, crypto.randomUUID());
          }
        });
      }
    });

    // Load and initialize all models
    models = loadModels(context);

    // Setup model-to-model associations
    setupAssociations(models);

    // Synchronize database schema
    await sequelizeInstance.sync({ force: true });

    return { sequelize: sequelizeInstance, models };
  } catch (err) {
    // Cleanup on failure
    if (sequelizeInstance) {
      try {
        await sequelizeInstance.close();
      } catch (closeErr) {
        console.error(
          'Error cleaning up database after setup failure:',
          closeErr,
        );
      }
    }
    throw new Error(`Database setup failed: ${err.message}`);
  }
}

/**
 * Closes the test database connection and cleans up resources.
 * Safe to call even if no database is open.
 *
 * @param {Sequelize} sequelizeInstance - The Sequelize instance to close
 * @returns {Promise<void>}
 *
 * @example
 * const db = await setupTestDb();
 * // ... run tests
 * await closeTestDb(db.sequelize);
 */
async function closeTestDb(sequelizeInstance) {
  if (!sequelizeInstance) {
    return;
  }

  try {
    await sequelizeInstance.close();
  } catch (err) {
    console.error('Error closing test database:', err);
    // Don't throw - we want cleanup to be forgiving
  }
}

module.exports = { setupTestDb, closeTestDb };
