/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import pluginRoutes from './routes/plugin.routes';

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

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

/**
 * Initialize plugins module API
 *
 * @param {Object} app - Express app instance
 * @param {Router} apiRouter - Main API Router
 * @param {Object} options - Options
 * @param {Function} options.Router - Express Router constructor
 */
export async function init(app, apiRouter, { Router }) {
  const db = app.get('db');

  // Run database migrations
  // Important: Permissions table created by 'users' module creates 'permissions' table.
  // Our migration '2026.02.12...create-plugins.js' creates 'plugins' and 'user_plugins' tables.
  await db.connection.runMigrations([
    { context: migrationsContext, prefix: 'plugins' },
  ]);

  // Run database seeds
  // Seeds permissions for plugins module
  await db.connection.runSeeds([{ context: seedsContext, prefix: 'plugins' }]);

  console.info('✅ [plugins] Migrations and seeds completed');

  // Mount plugin routes
  // The route file handles /admin sub-routes
  apiRouter.use('/plugins', pluginRoutes(app, { Router }));

  console.info('✅ [plugins] API routes registered');
}
