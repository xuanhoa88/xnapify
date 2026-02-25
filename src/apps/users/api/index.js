/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as RBAC_CONSTANTS from './constants/rbac';
import { authenticate as handleApiKeyStrategy } from './utils/apiKey';
import { getUserRBACData } from './utils/rbac/fetcher';

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
// LOGGING
// =============================================================================

const TAG = 'Users';

/**
 * Log a lifecycle phase message.
 *
 * @param {string} phase - Lifecycle phase name
 */
function log(phase) {
  console.info(`[${TAG}] ✅ ${phase}`);
}

/**
 * Register auth strategies and RBAC hook listeners.
 *
 * @param {Object} app - Express app instance
 */
async function registerAuthHooks(app) {
  const hook = app.get('hook');

  hook('auth.strategy.api_key').on('authenticate', handleApiKeyStrategy);
  hook('auth.permissions').on('resolve', getUserRBACData);
  hook('auth.roles').on('resolve', getUserRBACData);
  hook('auth.groups').on('resolve', getUserRBACData);
  hook('auth.ownership').on('resolve', getUserRBACData);

  log('Auth hooks registered');
}

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

  // Bind rbac constants to container as singleton
  container.bind('users:rbac_constants', () => RBAC_CONSTANTS, true);
}

/**
 * Migrations hook — run database migrations.
 *
 * @param {Object} app - Express app instance
 */
export async function migrations(app) {
  const db = app.get('db');

  await db.connection.runMigrations(
    [{ context: migrationsContext, prefix: 'users' }],
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

  await db.connection.runSeeds([{ context: seedsContext, prefix: 'users' }], {
    app,
  });
}

/**
 * Init hook — called by the autoloader to initialise this module.
 * @param {Object} app - Express app instance
 */
export async function init(app) {
  await registerAuthHooks(app);
}

/**
 * Models hook — returns the webpack require.context for this module's models.
 *
 * Called independently by the autoloader so each module
 * can be built and resolved as a standalone webpack entry.
 *
 * @returns {object} Webpack require.context for models
 */
export function models() {
  log('Models declared');
  return modelsContext;
}

/**
 * Routes hook — returns the webpack require.context for this module's routes.
 *
 * Called independently by the dynamic router so each module
 * can be built and resolved as a standalone webpack entry.
 *
 * @returns {object} Webpack require.context for routes
 */
export function routes() {
  log('Routes declared');
  return routesContext;
}
