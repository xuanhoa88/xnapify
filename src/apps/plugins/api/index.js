/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { registerPluginWorkers } from './services/plugin.workers';

// Auto-load migrations via require.context
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.[cm]?[jt]s$/i,
);

// Auto-load seeds via require.context
const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);

// Auto-load models via require.context
const modelsContext = require.context('./models', false, /\.[cm]?[jt]s$/i);

// Auto-load routes via require.context
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

// INTERNAL HELPERS
// =============================================================================

/**
 * Migrations hook — run database migrations.
 *
 * @param {Object} container - DI container instance
 */
export async function migrations(container) {
  const db = container.resolve('db');

  await db.connection.runMigrations(
    [{ context: migrationsContext, prefix: 'plugins' }],
    { container },
  );
}

/**
 * Seeds hook — run database seeds.
 *
 * @param {Object} container - DI container instance
 */
export async function seeds(container) {
  const db = container.resolve('db');

  await db.connection.runSeeds([{ context: seedsContext, prefix: 'plugins' }], {
    container,
  });
}

/**
 * Models hook — returns the webpack require.context for this module's models.
 *
 * @returns {object} Webpack require.context for models
 */
export function models() {
  return modelsContext;
}

/**
 * Routes hook — returns the webpack require.context for this module's routes.
 *
 * @returns {object} Webpack require.context for routes
 */
export function routes() {
  return routesContext;
}

/**
 * Init hook — register plugin workers.
 *
 * @param {Object} container - DI container instance
 */
export async function init(container) {
  registerPluginWorkers(container);
}
