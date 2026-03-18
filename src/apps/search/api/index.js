/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { registerSearchHooks } from './hooks';

// Auto-load routes via require.context
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

/**
 * Init hook — called by the autoloader to initialise this module.
 *
 * Sets up hooks for incremental index updates. Bulk indexing and worker
 * pools are owned by each domain module (users, groups).
 *
 * @param {Object} app - Express app instance
 */
export async function init(app) {
  registerSearchHooks(app);
  console.info('[Search] ✅ Initialized');
}

/**
 * Routes hook — returns the webpack require.context for this module's routes.
 *
 * @returns {object} Webpack require.context for routes
 */
export function routes() {
  return routesContext;
}
