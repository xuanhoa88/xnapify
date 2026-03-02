const SequelizeModule = require('sequelize');
const glob = require('glob');
const path = require('path');
const config = require('../config');

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

/**
 * Creates test-compatible DataTypes by polyfilling unsupported types.
 * SQLite doesn't support UUIDV1, so we fall back to UUIDV4.
 * @returns {Object} Modified DataTypes object
 */
function createTestDataTypes() {
  const testDataTypes = { ...SequelizeModule.DataTypes };
  // SQLite doesn't support UUIDV1, use UUIDV4 instead
  testDataTypes.UUIDV1 = SequelizeModule.UUIDV4;
  return testDataTypes;
}

/**
 * Loads all model definition files and initializes them.
 * @param {Object} context - Context object for model factories
 * @returns {Promise<Object>} Dictionary of initialized models
 * @throws {Error} If model loading or initialization fails
 */
function loadModels(context) {
  const loadedModels = {};
  const globPattern = path.join(config.CWD, MODEL_GLOB_PATTERN);
  const modelFiles = glob.sync(globPattern);

  if (modelFiles.length === 0) {
    throw new Error(`No model files found matching pattern: ${globPattern}`);
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
  for (const modelName of Object.keys(models)) {
    const model = models[modelName];

    if (typeof model.associate !== 'function') {
      continue;
    }

    try {
      model.associate(models);
    } catch (err) {
      throw new Error(
        `Failed to setup associations for ${modelName}: ${err.message}`,
      );
    }
  }
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
export async function setupTestDb() {
  let sequelizeInstance;
  let models;

  try {
    // Create fresh Sequelize instance for test isolation
    sequelizeInstance = new Sequelize('sqlite::memory:', SEQUELIZE_CONFIG);

    // Create context object with polyfilled DataTypes
    const context = {
      ...SequelizeModule,
      DataTypes: createTestDataTypes(),
      connection: sequelizeInstance,
    };

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
export async function closeTestDb(sequelizeInstance) {
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
