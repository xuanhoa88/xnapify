/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { SEED_USERS } from './constants';
import * as authController from './controllers/auth.controller';
import * as profileController from './controllers/profile.controller';
import { authenticate as handleApiKeyStrategy } from './utils/apiKey';
import { configurePassport } from './utils/passport';
import { getUserRBACData } from './utils/rbac/fetcher';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('users');

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

// Auto-load workers via require.context
const workersContext = require.context(
  './workers',
  false,
  /\.worker\.[cm]?[jt]s$/i,
);

// =============================================================================
// LOGGING
// =============================================================================

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
}

// =============================================================================
// PUBLIC LIFECYCLE HOOKS
// =============================================================================

/**
 * Providers hook — called by the autoloader to share services with other modules.
 *
 * @param {Object} app - Express app instance
 */
export async function providers(app) {
  const container = app.get('container');

  // Bind seed constants to container as singleton
  container.bind('users:seed_constants', () => SEED_USERS, OWNER_KEY);

  // Bind controllers to container as singleton
  container.bind(
    'users:controllers',
    () => ({
      profile: profileController,
      auth: authController,
    }),
    OWNER_KEY,
  );

  // Create search worker pool for user indexing
  const worker = app.get('worker');
  if (worker) {
    const { default: attachSearchMethods } = require('./workers');
    const pool = worker.createWorkerPool('UsersSearch', workersContext, {
      maxWorkers: 1,
    });
    const searchWorkerPool = attachSearchMethods(pool);
    container.bind('users:search:worker', () => searchWorkerPool, OWNER_KEY);
  }
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
  const passport = configurePassport();
  app.use(passport.initialize());
  await registerAuthHooks(app);

  // Bulk-index users for search (fire-and-forget)
  const search = app.get('search');
  const container = app.get('container');
  const searchWorkerPool = container.has('users:search:worker')
    ? container.make('users:search:worker')
    : null;

  if (searchWorkerPool && search) {
    searchWorkerPool.setSearch(search);
    searchWorkerPool.registerSearchHooks(app);

    const usersCount = await search.withNamespace('users').count();
    if (usersCount === 0) {
      searchWorkerPool
        .indexAllUsers(search, app.get('models'))
        .then(r => {
          const count = r && r.result ? r.result.usersCount : 0;
          console.info(`[Users] Indexed ${count} user(s) for search`);
        })
        .catch(e =>
          console.error('[Users] Search indexing failed:', e.message),
        );
    } else {
      // prettier-ignore
      console.info(`[Users] Using cached search index (${usersCount} user(s))`);
    }
  }
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
  return routesContext;
}
