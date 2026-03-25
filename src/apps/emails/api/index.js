/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { registerEmailHooks } from './hooks';

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
  async migrations({ container }) {
    const db = container.resolve('db');
    await db.connection.runMigrations(
      [{ context: migrationsContext, prefix: 'emails' }],
      { container },
    );
  },

  async seeds({ container }) {
    const db = container.resolve('db');
    await db.connection.runSeeds(
      [{ context: seedsContext, prefix: 'emails' }],
      { container },
    );
  },

  async boot({ container }) {
    registerEmailHooks(container);
  },

  models: () => modelsContext,
  routes: () => routesContext,
};
