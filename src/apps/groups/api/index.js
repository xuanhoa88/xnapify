/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { SEED_GROUPS } from './constants';
import { registerSearchHooks } from './workers';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.groups.api__');

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
    container.bind('groups:seed_constants', () => SEED_GROUPS, OWNER_KEY);
    registerSearchHooks(container);
  }
};