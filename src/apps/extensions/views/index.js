/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import hubReducer, {
  SLICE_NAME as HUB_SLICE,
} from './(admin)/hub/redux/index.js';
import { createRegisterHubMenu } from './menu.js';

// Auto-load contexts
// `mode: 'lazy'` emits one chunk per view instead of bundling every route
// of every module into the page that boots the router. load() then returns a
// promise, which the router handles by building its tree from file paths and
// materialising a route the first time it is matched.
const viewsContext = import.meta.webpackContext('.', {
  recursive: true,
  regExp:
    /(?:\/_route|\/_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
  mode: 'lazy',
});
// `mode: 'lazy'` puts each locale in its own chunk. The i18n resource
// registry pulls only the language in use, and pulls another one when the
// user switches. See shared/i18n/resources.js.
const translationsContext = import.meta.webpackContext('../translations', {
  recursive: false,
  regExp: /\.json$/i,
  mode: 'lazy',
});

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  translations() {
    return [translationsContext];
  },
  providers({ store }) {
    store.injectReducer(HUB_SLICE, hubReducer);
  },
  /**
   * Admin navigation contributed by this module.
   * The Manage page re-registers the same section with an update badge once
   * it has a count; `registerMenu` merges by id, so this is the base state.
   */
  menus({ store, i18n }) {
    createRegisterHubMenu(store, i18n)(0);
  },
  routes: () => [viewsContext, { lazy: true }],
};
