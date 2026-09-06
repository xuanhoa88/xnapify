/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Posts admin page — route definition
 */

import { requirePermission } from '@shared/renderer/components/Rbac/index.js';
import { features } from '@shared/renderer/redux/index.js';

import reducer, { SLICE_NAME } from '../redux/index.js';

import Posts from './Posts.js';

const { addBreadcrumb } = features;

export const middleware = requirePermission('posts:read');

/**
 * Route boot — inject Redux reducer into the store.
 * Runs per-route during resolution where store is always available
 * (client: persistent store, server: per-request SSR store).
 */
export function init({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

// NOTE: the sidebar entry is registered from this extension's `menus()` hook
// in views/index.js, not here. A route module only exists once its route has
// been matched, and the sidebar has to list the page before the user can
// navigate to it. `shutdown()` removes the entry when the extension is
// deactivated.

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
