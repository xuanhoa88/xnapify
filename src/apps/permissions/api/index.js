/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

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

const TAG = 'Permissions';

/**
 * Log a lifecycle phase message.
 *
 * @param {string} phase - Lifecycle phase name
 */
function log(phase) {
  console.info(`[${TAG}] ✅ ${phase}`);
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Run database migrations and seeds.
 *
 * @param {Object} app - Express app instance
 */
async function runMigrations(app) {
  const db = app.get('db');

  await db.connection.runMigrations([
    { context: migrationsContext, prefix: 'permissions' },
  ]);

  await db.connection.runSeeds([
    { context: seedsContext, prefix: 'permissions' },
  ]);

  log('Database migrated');
}

// =============================================================================
// PUBLIC LIFECYCLE HOOKS
// =============================================================================

/**
 * Init hook — called by the autoloader to initialise this module.
 *
 * @param {Object} app - Express app instance
 * @param {Object} _options - Options ({ CORE_MODULES })
 */
export async function init(app, _options) {
  await runMigrations(app);
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
