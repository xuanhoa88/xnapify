/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import RoleTag from './(admin)/components/RoleTag';
import * as selectors from './(admin)/redux/selector';
import * as thunks from './(admin)/redux/thunks';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('users:views');

// Auto-load view routes via require.context
// Matches: _route.js, _layout.js, (routes)/(*).js, (layouts)/(*) /_layout.js
const viewsContext = require.context(
  '.',
  true,
  /(?:\/_route|\/_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
);

// =============================================================================
// LOGGING
// =============================================================================

const TAG = 'Users';

/**
 * Log a lifecycle phase message.
 *
 * @param {string} phase - Lifecycle phase name
 */
function log(phase) {
  console.info(`[${TAG}] ✅ ${phase}`);
}

// =============================================================================
// PUBLIC LIFECYCLE HOOK
// =============================================================================

/**
 * Providers hook — called during view bootstrap to share
 * client-side services/state with other view modules.
 *
 * @param {Object} context - Shared context (e.g., container, plugin)
 */
export function providers({ container }) {
  // Bind admin state
  container.bind('users:admin:state', () => ({ selectors, thunks }), OWNER_KEY);

  // Bind admin components
  container.bind('users:admin:components', () => ({ RoleTag }), OWNER_KEY);
}

/**
 * Views hook — returns the webpack require.context for this module's views.
 *
 * Called independently by the renderer router so each module
 * can be built and resolved as a standalone webpack entry.
 *
 * @returns {object} Webpack require.context for views
 */
export function views() {
  log('Views declared');
  return viewsContext;
}
