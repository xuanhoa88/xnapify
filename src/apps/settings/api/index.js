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
    // Register settings service on the DI container.
    // Available to all modules loaded after this one (e.g. in their boot() hooks).
    container.bind(
      'settings',
      () => createSettingsService(container),
      OWNER_KEY,
    );
  },
};
