/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { SEED_GROUPS } from './constants';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('groups:api');

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

// Auto-load workers via require.context
const workersContext = require.context(
  './workers',
  false,
  /\.worker\.[cm]?[jt]s$/i,
);

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  async providers({ container }) {
    container.bind('groups:seed_constants', () => SEED_GROUPS, OWNER_KEY);

    const worker = container.resolve('worker');
    if (worker) {
      const { default: attachSearchMethods } = require('./workers');
      const pool = worker.createWorkerPool('GroupsSearch', workersContext, {
        maxWorkers: 1,
      });
      const searchWorkerPool = attachSearchMethods(pool);
      container.bind(
        'groups:search:worker',
        () => searchWorkerPool,
        OWNER_KEY,
      );
    }
  },

  async migrations({ container }) {
    const db = container.resolve('db');
    await db.connection.runMigrations(
      [{ context: migrationsContext, prefix: 'groups' }],
      { container },
    );
  },

  async seeds({ container }) {
    const db = container.resolve('db');
    await db.connection.runSeeds(
      [{ context: seedsContext, prefix: 'groups' }],
      { container },
    );
  },

  async boot({ container }) {
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
  },

  models: () => modelsContext,
  routes: () => routesContext,
};
