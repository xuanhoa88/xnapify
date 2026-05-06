/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as authController from './controllers/auth.controller.js';
import * as profileController from './controllers/profile.controller.js';
import { authenticate as handleApiKeyStrategy } from './utils/apiKey/index.js';
import { getUserRbacData } from './utils/rbac/fetcher.js';
import { registerSearchHooks } from './workers/index.js';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.users.api__');

// Auto-load contexts
const migrationsContext = import.meta.webpackContext('./database/migrations', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});
const modelsContext = import.meta.webpackContext('./models', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});
const routesContext = import.meta.webpackContext('./routes', {
  recursive: true,
  regExp: /\.[cm]?[jt]s$/i,
});

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
  hook('auth.permissions').on('resolve', getUserRbacData);
  hook('auth.roles').on('resolve', getUserRbacData);
  hook('auth.groups').on('resolve', getUserRbacData);
  hook('auth.ownership').on('resolve', getUserRbacData);
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
    await registerAuthHooks(container);
    registerSearchHooks(container);
  },
};
