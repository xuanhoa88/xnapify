/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import reducer, { SLICE_NAME } from './(admin)/redux';

// Auto-load view routes via require.context
const viewsContext = require.context(
  '.',
  true,
  /(?:\/_route|\/_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
);

// =============================================================================
// PUBLIC LIFECYCLE HOOKS
// =============================================================================

/**
 * Providers hook — inject Redux reducers at bootstrap time.
 */
export function providers({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Views hook — returns the webpack require.context for this module's views.
 *
 * @returns {object} Webpack require.context for views
 */
export function views() {
  return viewsContext;
}
