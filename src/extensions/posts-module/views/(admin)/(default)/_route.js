/**
 * Posts admin page — route definition
 */
import { requirePermission } from '@shared/renderer/components/Rbac';
import {
  addBreadcrumb,
  registerMenu,
  unregisterMenu,
} from '@shared/renderer/redux';

import reducer, { SLICE_NAME } from '../redux';

import Posts from './Posts';

export const namespace = 'posts';

export const middleware = requirePermission('posts:read');

/**
 * Route init — inject Redux reducer into the store.
 * Runs per-route during resolution where store is always available
 * (client: persistent store, server: per-request SSR store).
 */
export function init({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Register menu item for this route
 */
export function register({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      id: 'content',
      label: i18n.t('admin:navigation.content', 'Content'),
      order: 20,
      icon: 'folder',
      items: [
        {
          path: '/admin/posts',
          label: i18n.t('admin:navigation.posts', 'Posts'),
          icon: 'book-open',
          permission: 'posts:read',
          order: 10,
        },
      ],
    }),
  );
}

/**
 * Unregister menu item for this route
 */
export function unregister({ store }) {
  store.dispatch(
    unregisterMenu({
      ns: 'admin',
      path: '/admin/posts',
    }),
  );
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.posts', 'Posts'),
  };
}

/**
 * Mount function — dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      { label: i18n.t('admin:navigation.posts', 'Posts'), url: path },
      'admin',
    ),
  );
}

/**
 * Default export — Page component
 */
export default Posts;
