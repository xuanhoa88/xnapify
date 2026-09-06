/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { features } from '@shared/renderer/redux/index.js';

const { registerMenu } = features;

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
    return [translationsContext, 'translation'];
  },
  providers() {
    // The (default) module owns keys like login.*, register.*, profile.*, navigation.*
    // that components access via bare useTranslation() calls.
  },
  /**
   * Admin navigation contributed by this module.
   * Declared here rather than in a route module so the sidebar is complete
   * before any route is loaded. See shared/utils/lifecycle.js.
   *
   * `ns` is the literal 'admin' every other module uses — the drawer reads
   * `ui.menus.admin`. It must never be a translated string: `registerMenu`
   * creates a section per distinct `ns`, so a translated one both hides the
   * link and leaves an orphan section behind on every language switch.
   */
  menus({ store, i18n }) {
    store.dispatch(
      registerMenu({
        ns: 'admin',
        id: 'main',
        label: i18n.t('admin:navigation.main', 'Main'),
        order: 0,
        icon: 'DashboardIcon',
        items: [
          {
            path: '/admin',
            label: i18n.t('admin:navigation.dashboard', 'Dashboard'),
            icon: 'DashboardIcon',
            exact: true,
            order: 0,
          },
        ],
      }),
    );
  },
  routes: () => [viewsContext, { lazy: true }],
};
