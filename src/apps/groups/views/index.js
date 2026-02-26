/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as selectors from './(admin)/redux/selector';
import * as thunks from './(admin)/redux/thunks';

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

const TAG = 'Groups';

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
 * Shared hook — called during view bootstrap to share
 * client-side services/state with other view modules.
 *
 * @param {Object} context - Shared context (e.g., container, plugin)
 */
export function shared({ container }) {
  // Bind admin state
  container.bind('groups:admin:state', () => ({ selectors, thunks }), true);
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
