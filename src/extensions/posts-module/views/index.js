/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Posts Module — View entry point
 *
 * Module-type extension that provides view routes via the views() hook.
 * Redux reducer injection is handled per-route in _route.js init().
 */

import { features } from '@shared/renderer/redux/index.js';

const { registerMenu, unregisterMenu } = features;

const viewsContext = import.meta.webpackContext('.', {
  recursive: true,
  regExp: /(?:\/_route|\/_layout)\.[cm]?[jt]sx?$/i,
});
const translationsContext = import.meta.webpackContext('../translations', {
  recursive: false,
  regExp: /\.json$/i,
});

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  /**
   * Lifecycle: providers — bind DI services shared with other modules.
   */
  providers() {},

  /**
   * Declarative translations — auto-registered by extension manager.
   */
  translations() {
    return translationsContext;
  },
  /**
   * Lifecycle: menus — contribute the sidebar entry for this extension.
   *
   * Navigation belongs to the extension, not to one of its routes: the entry
   * has to exist on every page, while a route module is only reached once the
   * user is already on the page it links to. The manager runs this on
   * activation, once per SSR request, and again whenever the language changes.
   */
  menus({ store, i18n }) {
    store.dispatch(
      registerMenu({
        ns: 'admin',
        id: 'content',
        label: i18n.t('admin:navigation.content', 'Content'),
        order: 20,
        icon: 'FileTextIcon',
        items: [
          {
            path: '/admin/posts',
            label: i18n.t('admin:navigation.posts', 'Posts'),
            icon: 'ReaderIcon',
            permission: 'posts:read',
            order: 10,
          },
        ],
      }),
    );
  },

  /**
   * Lifecycle: shutdown — remove the sidebar entry when deactivated.
   *
   * Unlike an application module, an extension can be switched off at
   * runtime, so its navigation needs an explicit counterpart to `menus`.
   */
  shutdown({ store }) {
    store.dispatch(unregisterMenu({ ns: 'admin', path: '/admin/posts' }));
  },

  /**
   * Module-type hook: provides view routes for dynamic injection.
   * Returns [moduleName, context] — the framework auto-builds the adapter.
   */
  routes() {
    return ['posts', viewsContext];
  },
};
