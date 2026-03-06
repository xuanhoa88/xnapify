/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as selectors from './(admin)/redux/selector';
import slice from './(admin)/redux/slice';
import * as thunks from './(admin)/redux/thunks';

// Auto-load view routes via require.context
const viewsContext = require.context(
  '.',
  true,
  /(?:\/_route|\/_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
);

// =============================================================================
// PUBLIC LIFECYCLE HOOK
// =============================================================================

/**
 * Providers hook — called during view bootstrap to share
 * client-side services/state with other view modules.
 */
export function providers({ container }) {
  // Bind admin state
  container.bind(
    'files:admin:state',
    () => ({ slice, selectors, thunks }),
    true,
  );
}

/**
 * Views hook — returns the webpack require.context for this module's views.
 *
 * @returns {object} Webpack require.context for views
 */
export function views() {
  return viewsContext;
}
