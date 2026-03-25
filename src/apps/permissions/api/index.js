/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { SEED_PERMISSIONS } from './constants';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('permissions:api');

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
  async providers({ container }) {
    container.bind(
      'permissions:seed_constants',
      () => SEED_PERMISSIONS,
      OWNER_KEY,
    );
  },

  async migrations({ container }) {
    const db = container.resolve('db');
    await db.connection.runMigrations(
      [{ context: migrationsContext, prefix: 'permissions' }],
      { container },
    );
  },

  async seeds({ container }) {
    const db = container.resolve('db');
    await db.connection.runSeeds(
      [{ context: seedsContext, prefix: 'permissions' }],
      { container },
    );
  },

  async boot() {},

  models: () => modelsContext,
  routes: () => routesContext,
};
