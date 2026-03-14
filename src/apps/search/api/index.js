/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { registerSearchHooks } from './hooks';
import getSearchWorkerPool from './workers';

let searchWorkerPool = null;

// Auto-load routes via require.context
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

/**
 * Providers hook — share services with other modules.
 *
 * @param {Object} app - Express app instance
 */
export async function providers(app) {
  const container = app.get('container');
  searchWorkerPool = getSearchWorkerPool(app);

  // Expose search worker pool so other modules can trigger indexAll
  container.bind('search:worker', () => searchWorkerPool, true);
}

/**
 * Init hook — called by the autoloader to initialise this module.
 *
 * Dispatches initial indexing of users and groups to a background worker
 * so that app startup is not blocked.
 *
 * @param {Object} app - Express app instance
 */
export async function init(app) {
  const search = app.get('search');
  const models = app.get('models');

  if (search && models) {
    // Bind search engine so convenience methods work without passing search
    searchWorkerPool.setSearch(search);

    // Register hooks to observe changes and update index
    registerSearchHooks(app);

    // Fire-and-forget — don't await, let it run in the background
    searchWorkerPool
      .indexAll(search, models)
      .then(result => {
        if (result && result.result) {
          const { usersCount, groupsCount } = result.result;
          console.info(
            `[Search] Indexed ${usersCount} user(s), ${groupsCount} group(s)`,
          );
        }
      })
      .catch(error => {
        console.error('[Search] Initial indexing failed:', error.message);
      });
  }

  console.info('[Search] ✅ Initialized');
}

/**
 * Routes hook — returns the webpack require.context for this module's routes.
 *
 * @returns {object} Webpack require.context for routes
 */
export function routes() {
  return routesContext;
}
