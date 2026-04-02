/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { SEED_GROUPS } from './constants';
import { indexAllGroups, registerSearchHooks } from './workers';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.groups.api__');

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

export default {
  migrations: () => migrationsContext,
  seeds: () => seedsContext,
  models: () => modelsContext,
  routes: () => routesContext,

  async providers({ container }) {
    container.bind('groups:seed_constants', () => SEED_GROUPS, OWNER_KEY);
  },

  async boot({ container }) {
    const search = container.resolve('search');

    if (search) {
      registerSearchHooks(container, search);

      const groupsCount = await search.withNamespace('groups').count();
      if (groupsCount === 0) {
        indexAllGroups(search, container.resolve('models'))
          .then(r => {
            const count = r ? r.groupsCount : 0;
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
};
