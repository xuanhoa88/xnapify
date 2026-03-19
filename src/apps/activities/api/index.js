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

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('activities');

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
 * @param {Object} container - DI container instance
 */
export async function providers(container) {
  const workerPool = getActivityWorkerPool(container);

  // Expose worker pool so other modules (if any) can call it directly
  container.bind('activities:worker', () => workerPool, OWNER_KEY);
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
export async function migrations(container) {
  const db = container.resolve('db');
  await db.connection.runMigrations(
    [{ context: migrationsContext, prefix: 'activities' }],
    { container },
  );
}

/**
 * Seeds hook — run database seeds.
 */
export async function seeds(container) {
  const db = container.resolve('db');
  await db.connection.runSeeds(
    [{ context: seedsContext, prefix: 'activities' }],
    { container },
  );
}

/**
 * Init hook — called by the autoloader to initialise this module.
 */
export async function init(container) {
  // Register hooks to observe system changes
  registerActivityHooks(container);

  console.info('[Activity] ✅ Initialized');
}

/**
 * Routes hook — returns the webpack require.context for routes.
 */
export function routes() {
  return routesContext;
}
