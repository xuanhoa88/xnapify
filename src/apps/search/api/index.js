/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createFactory, registerAdapter } from './factory';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.search.api__');

// Auto-load contexts
const migrationsContext = require.context(
  './database/migrations',
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
  models: () => modelsContext,
  routes: () => routesContext,

  async providers({ container }) {
    // Lazy binding — factory executes on first resolve('search'),
    // by which time extensions have registered custom adapters + type
    container.bind(
      'search',
      c => {
        // Extension can override type via container binding
        // Priority: search:type binding > XNAPIFY_SEARCH_TYPE env > 'database'
        const type = c.has('search:type')
          ? c.resolve('search:type')
          : process.env.XNAPIFY_SEARCH_TYPE || 'database';

        // Extension can provide adapter-specific options
        const extraOptions = c.has('search:options')
          ? c.resolve('search:options')
          : {};

        return createFactory({
          type,
          model: c.resolve('models').SearchDocument,
          ...extraOptions,
        });
      },
      OWNER_KEY,
    );

    // Expose registerAdapter for extensions to add custom backends
    container.bind('search:registerAdapter', () => registerAdapter, OWNER_KEY);
  },

  async boot() {
    console.info('[Search] ✅ Initialized');
  },
};
