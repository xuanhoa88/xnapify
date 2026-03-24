/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as selectors from './(admin)/redux/selector';
import * as thunks from './(admin)/redux/thunks';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('emails:views');

// Auto-load view routes via require.context
const viewsContext = require.context(
  '.',
  true,
  /(?:\/_route|\/_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
);

// =============================================================================
// LOGGING
// =============================================================================

const TAG = 'Emails';

/**
 * Log a lifecycle phase message.
 */
function log(phase) {
  console.info(`[${TAG}] ✅ ${phase}`);
}

// =============================================================================
// PUBLIC LIFECYCLE HOOKS
// =============================================================================

/**
 * Providers hook — called during view bootstrap to share
 * client-side services/state with other view modules.
 */
export function providers({ container }) {
  container.bind(
    'emails:admin:state',
    () => ({ selectors, thunks }),
    OWNER_KEY,
  );
}

/**
 * Views hook — returns the webpack require.context for this module's views.
 */
export function views() {
  log('Views declared');
  return viewsContext;
}
