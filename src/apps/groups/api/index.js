/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { SEED_GROUPS } from './constants';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('groups:api');

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
// PUBLIC LIFECYCLE HOOKS
// =============================================================================

/**
 * Providers hook — called by the autoloader to share services with other modules.
 *
 * @param {Object} container - DI container instance
 */
export async function providers(container) {
  // Bind seed groups to container as singleton
  container.bind('groups:seed_constants', () => SEED_GROUPS, OWNER_KEY);

  // Create search worker pool for group indexing
  const worker = container.resolve('worker');
  if (worker) {
    const { default: attachSearchMethods } = require('./workers');
    const pool = worker.createWorkerPool('GroupsSearch', workersContext, {
      maxWorkers: 1,
    });
    const searchWorkerPool = attachSearchMethods(pool);
    container.bind('groups:search:worker', () => searchWorkerPool, OWNER_KEY);
  }
}

/**
 * Migrations hook — run database migrations.
 *
 * @param {Object} container - DI container instance
 */
export async function migrations(container) {
  const db = container.resolve('db');

  await db.connection.runMigrations(
    [{ context: migrationsContext, prefix: 'groups' }],
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

  await db.connection.runSeeds([{ context: seedsContext, prefix: 'groups' }], {
    container,
  });
}

/**
 * Init hook — called by the autoloader to initialise this module.
 *
 * @param {Object} container - DI container instance
 */
export async function init(container) {
  // Bulk-index groups for search (fire-and-forget)
  const search = container.resolve('search');
  const searchWorkerPool = container.has('groups:search:worker')
    ? container.make('groups:search:worker')
    : null;

  if (searchWorkerPool && search) {
    searchWorkerPool.setSearch(search);
    searchWorkerPool.registerSearchHooks(container);

    const groupsCount = await search.withNamespace('groups').count();
    if (groupsCount === 0) {
      searchWorkerPool
        .indexAllGroups(search, container.resolve('models'))
        .then(r => {
          const count = r && r.result ? r.result.groupsCount : 0;
          console.info(`[Groups] Indexed ${count} group(s) for search`);
        })
        .catch(e =>
          console.error('[Groups] Search indexing failed:', e.message),
        );
    } else {
      console.info(
        `[Groups] Using cached search index (${groupsCount} group(s))`,
      );
    }
  }
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
