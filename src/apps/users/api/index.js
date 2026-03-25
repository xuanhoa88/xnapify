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
import { getUserRBACData } from './utils/rbac/fetcher';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('users:api');

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
 * @param {Object} container - DI container instance
 */
async function registerAuthHooks(container) {
  const hook = container.resolve('hook');

  hook('auth.strategy.api_key').on('authenticate', handleApiKeyStrategy);
  hook('auth.permissions').on('resolve', getUserRBACData);
  hook('auth.roles').on('resolve', getUserRBACData);
  hook('auth.groups').on('resolve', getUserRBACData);
  hook('auth.ownership').on('resolve', getUserRBACData);
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  async providers({ container }) {
    container.bind('users:seed_constants', () => SEED_USERS, OWNER_KEY);

    container.bind(
      'users:controllers',
      () => ({
        profile: profileController,
        auth: authController,
      }),
      OWNER_KEY,
    );

    const worker = container.resolve('worker');
    if (worker) {
      const { default: attachSearchMethods } = require('./workers');
      const pool = worker.createWorkerPool('UsersSearch', workersContext, {
        maxWorkers: 1,
      });
      const searchWorkerPool = attachSearchMethods(pool);
      container.bind('users:search:worker', () => searchWorkerPool, OWNER_KEY);
    }
  },

  async migrations({ container }) {
    const db = container.resolve('db');
    await db.connection.runMigrations(
      [{ context: migrationsContext, prefix: 'users' }],
      { container },
    );
  },

  async seeds({ container }) {
    const db = container.resolve('db');
    await db.connection.runSeeds([{ context: seedsContext, prefix: 'users' }], {
      container,
    });
  },

  async boot({ container }) {
    await registerAuthHooks(container);

    const search = container.resolve('search');
    const searchWorkerPool = container.has('users:search:worker')
      ? container.make('users:search:worker')
      : null;

    if (searchWorkerPool && search) {
      searchWorkerPool.setSearch(search);
      searchWorkerPool.registerSearchHooks(container);

      const usersCount = await search.withNamespace('users').count();
      if (usersCount === 0) {
        searchWorkerPool
          .indexAllUsers(search, container.resolve('models'))
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
  },

  models: () => modelsContext,
  routes: () => routesContext,
};
