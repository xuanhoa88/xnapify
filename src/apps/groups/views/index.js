/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import reducer, { SLICE_NAME } from './(admin)/redux/index.js';
import * as selectors from './(admin)/redux/selector.js';
import * as thunks from './(admin)/redux/thunks.js';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.groups.views__');

// Auto-load contexts
const viewsContext = import.meta.webpackContext('.', {
  recursive: true,
  regExp:
    /(?:\/_route|\/_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
});
const translationsContext = import.meta.webpackContext('../translations', {
  recursive: false,
  regExp: /\.json$/i,
});

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  translations() {
    return [translationsContext];
  },
  providers({ store, container }) {
    store.injectReducer(SLICE_NAME, reducer);
    container.bind(
      'groups:admin:state',
      () => ({
        selectors,
        thunks,
      }),
      OWNER_KEY,
    );
  },
  routes: () => viewsContext,
};
