/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Module Entry Point
 */

import { registerActivityHooks } from './hooks';
import getActivityWorkerPool from './workers';

// Auto-load contexts
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.[cm]?[jt]s$/i,
);
const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);
const modelsContext = require.context('./models', false, /\.[cm]?[jt]s$/i);
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

/**
 * Providers hook — share services with other modules.
 * @param {Object} app - Express app instance
 */
export async function providers(app) {
  const container = app.get('container');
  const workerPool = getActivityWorkerPool(app);

  // Expose worker pool so other modules (if any) can call it directly
  container.bind('activities:worker', () => workerPool, true);
}

/**
 * Models hook — returns the webpack require.context for models.
 */
export function models() {
  return modelsContext;
}

/**
 * Migrations hook — run database migrations.
 */
export async function migrations(app) {
  const db = app.get('db');
  await db.connection.runMigrations(
    [{ context: migrationsContext, prefix: 'activities' }],
    { app },
  );
}

/**
 * Seeds hook — run database seeds.
 */
export async function seeds(app) {
  const db = app.get('db');
  await db.connection.runSeeds(
    [{ context: seedsContext, prefix: 'activities' }],
    { app },
  );
}

/**
 * Init hook — called by the autoloader to initialise this module.
 */
export async function init(app) {
  // Register hooks to observe system changes
  registerActivityHooks(app);

  console.info('[Activity] ✅ Initialized');
}

/**
 * Routes hook — returns the webpack require.context for routes.
 */
export function routes() {
  return routesContext;
}
