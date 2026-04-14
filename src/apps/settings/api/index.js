/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSettingsService } from './services/settings.service';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.settings.api__');

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
    // Register settings service on the DI container as a persistent singleton.
    // Available to all modules loaded after this one (e.g. in their boot() hooks).
    container.singleton(
      'settings',
      () => createSettingsService(container),
      OWNER_KEY,
    );
  },

  async boot({ container }) {
    const settings = container.resolve('settings');
    const hook = container.resolve('hook');

    // Sync DB-overridden settings to process.env so legacy systems can reuse them.
    // Also snapshots original env values for safe restore on null reset.
    await settings.syncBootToEnv();

    // Register inter-module hooks securely
    hook('auth').on('before_register', async () => {
      const allowRegistration = await settings.get(
        'auth',
        'ALLOW_REGISTRATION',
      );
      if (allowRegistration === false) {
        const error = new Error('Registration is currently disabled.');
        error.name = 'RegistrationDisabledError';
        error.status = 403;
        throw error;
      }
    });
  },
};
