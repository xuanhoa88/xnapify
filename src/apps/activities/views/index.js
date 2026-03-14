/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Module Views Entry Point
 */

import * as selectors from './(admin)/redux/selector';
import * as thunks from './(admin)/redux/thunks';

// Auto-load view routes via require.context
const viewsContext = require.context(
  '.',
  true,
  /(?:\/_route|\/_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
);

/**
 * Providers hook — share client-side services/state with other view modules.
 */
export function providers({ container }) {
  // Bind activities state
  container.bind('activities:admin:state', () => ({ selectors, thunks }), true);
}

/**
 * Views hook — returns the webpack require.context for this module's views.
 */
export function views() {
  return viewsContext;
}
