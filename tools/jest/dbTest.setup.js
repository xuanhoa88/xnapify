import * as SequelizeModule from 'sequelize';
import { Sequelize } from 'sequelize';
import glob from 'glob';
import path from 'path';
import config from '../config';

let sequelizeInstance = null;
let models = {};

/**
 * Bootstraps an in-memory SQLite database populated with all Identity & Access Management models.
 */
export async function setupTestDb() {
  if (sequelizeInstance) {
    await sequelizeInstance.sync({ force: true });
    return { sequelize: sequelizeInstance, models };
  }

  sequelizeInstance = new Sequelize('sqlite::memory:', {
    logging: false, // Turn off logging for tests
    define: {
      freezeTableName: true,
      timestamps: true,
    },
  });

  // Polyfill UUIDV1 to UUIDV4 for SQLite test compatibility
  const testDataTypes = { ...SequelizeModule.DataTypes };
  testDataTypes.UUIDV1 = SequelizeModule.UUIDV4;
  testDataTypes.UUIDV4 = SequelizeModule.UUIDV4;

  const context = {
    ...SequelizeModule,
    DataTypes: testDataTypes,
    connection: sequelizeInstance,
  };

  // Use glob to dynamically find all model definition files
  const p = path.join(config.CWD, '**/apps/**/api/models/*.js');
  const modelFiles = glob.sync(p); // glob.sync is provided by the package

  modelFiles.forEach(file => {
    // Only process definitions, ignore indexes or other utilities if any
    if (!file.endsWith('index.js')) {
      const initModel = require(file).default;
      if (typeof initModel === 'function') {
        const model = initModel(context);
        models[model.name] = model;
      }
    }
  });

  // Run associations
  Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
      models[modelName].associate(models);
    }
  });

  await sequelizeInstance.sync({ force: true });
  return { sequelize: sequelizeInstance, models };
}

export async function closeTestDb() {
  if (sequelizeInstance) {
    await sequelizeInstance.close();
    sequelizeInstance = null;
    models = {};
  }
}
