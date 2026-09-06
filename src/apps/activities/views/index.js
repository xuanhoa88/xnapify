/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { features } from '@shared/renderer/redux/index.js';

const { registerMenu } = features;

/**
 * Activity Module Views Entry Point
 */

import reducer, { SLICE_NAME } from './(admin)/redux/index.js';
import * as selectors from './(admin)/redux/selector.js';
import * as thunks from './(admin)/redux/thunks.js';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.activities.views__');

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
  providers({ store, container }) {
    store.injectReducer(SLICE_NAME, reducer);
    container.bind(
      'activities:admin:state',
      () => ({
        selectors,
        thunks,
      }),
      OWNER_KEY,
    );
  },
  /**
   * Admin navigation contributed by this module.
   * Declared here rather than in a route module so the sidebar is complete
   * before any route is loaded. See shared/utils/lifecycle.js.
   */
  menus({ store, i18n }) {
    store.dispatch(
      registerMenu({
        ns: 'admin',
        id: 'system',
        label: i18n.t('admin:navigation.system', 'System'),
        order: 99,
        icon: 'ActivityLogIcon',
        items: [
          {
            path: '/admin/activities',
            label: i18n.t('admin:navigation.activities', 'Activity Logs'),
            icon: 'ActivityLogIcon',
            permission: 'activities:read',
            order: 10,
          },
        ],
      }),
    );
  },
  routes: () => [viewsContext, { lazy: true }],
};
