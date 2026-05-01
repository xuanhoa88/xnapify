/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import hubReducer, { SLICE_NAME as HUB_SLICE } from './(admin)/hub/redux';

// Auto-load contexts
const viewsContext = require.context(
  '.',
  true,
  /(?:\/_route|\/_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
);

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  providers({ store }) {
    store.injectReducer(HUB_SLICE, hubReducer);
  },
  routes: () => viewsContext,
};
