/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { registerEmailHooks } from './hooks';
import { createSendTemplatedEmail } from './services/send.service';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.emails.api__');

// Auto-load contexts
const migrationsContext = import.meta.webpackContext('./database/migrations', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i
});
const seedsContext = import.meta.webpackContext('./database/seeds', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i
});
const modelsContext = import.meta.webpackContext('./models', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i
});
const routesContext = import.meta.webpackContext('./routes', {
  recursive: true,
  regExp: /\.[cm]?[jt]s$/i
});

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  migrations: () => migrationsContext,
  seeds: () => seedsContext,
  models: () => modelsContext,
  routes: () => routesContext,
  async providers({
    container
  }) {
    container.bind('emails:send', () => createSendTemplatedEmail(container), OWNER_KEY);
  },
  async boot({
    container
  }) {
    registerEmailHooks(container);
  }
};