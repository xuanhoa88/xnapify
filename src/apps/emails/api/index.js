/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { registerEmailHooks } from './hooks';
import { createSendTemplatedEmail } from './services/send.service';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('emails:api');

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
    container.bind(
      'emails:send',
      () => createSendTemplatedEmail(container),
      OWNER_KEY,
    );
  },

  async boot({ container }) {
    registerEmailHooks(container);
  },
};
