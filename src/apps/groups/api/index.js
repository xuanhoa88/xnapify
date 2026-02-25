/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { SEED_GROUPS } from './constants';

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
const routesContext = require.context('./routes', false, /\.[cm]?[jt]s$/i);

// =============================================================================
// PUBLIC LIFECYCLE HOOKS
// =============================================================================

/**
 * Shared hook — called by the autoloader to share services with other modules.
 *
 * @param {Object} app - Express app instance
 */
export async function shared(app) {
  const container = app.get('container');

  // Bind seed groups to container as singleton
  container.bind('SEED:GROUPS', () => SEED_GROUPS, true);
}

/**
 * Migrations hook — run database migrations.
 *
 * @param {Object} app - Express app instance
 */
export async function migrations(app) {
  const db = app.get('db');

  await db.connection.runMigrations(
    [{ context: migrationsContext, prefix: 'groups' }],
    { app },
  );
}

/**
 * Seeds hook — run database seeds.
 *
 * @param {Object} app - Express app instance
 */
export async function seeds(app) {
  const db = app.get('db');

  await db.connection.runSeeds([{ context: seedsContext, prefix: 'groups' }], {
    app,
  });
}

/**
 * Init hook — called by the autoloader to initialise this module.
 *
 * @param {Object} _app - Express app instance
 */
export async function init(_app) {}

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
