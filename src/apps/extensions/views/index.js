/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

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

const TAG = 'Extensions';

/**
 * Log a lifecycle phase message.
 *
 * @param {string} phase - Lifecycle phase name
 */
function log(phase) {
  console.info(`[${TAG}] ✅ ${phase}`);
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
