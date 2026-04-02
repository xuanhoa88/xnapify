/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as authController from './controllers/auth.controller';
import * as profileController from './controllers/profile.controller';
import { authenticate as handleApiKeyStrategy } from './utils/apiKey';
import { getUserRBACData } from './utils/rbac/fetcher';
import { indexAllUsers, registerSearchHooks } from './workers';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.users.api__');

// Auto-load contexts
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.[cm]?[jt]s$/i,
);

const modelsContext = require.context('./models', false, /\.[cm]?[jt]s$/i);
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

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
  migrations: () => migrationsContext,
  models: () => modelsContext,
  routes: () => routesContext,

  async providers({ container }) {
    container.bind(
      'users:controllers',
      () => ({
        profile: profileController,
        auth: authController,
      }),
      OWNER_KEY,
    );
  },

  async boot({ container }) {
    await registerAuthHooks(container);

    const search = container.resolve('search');

    if (search) {
      registerSearchHooks(container, search);

      const usersCount = await search.withNamespace('users').count();
      if (usersCount === 0) {
        indexAllUsers(search, container.resolve('models'))
          .then(r => {
            const count = r ? r.usersCount : 0;
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
};
