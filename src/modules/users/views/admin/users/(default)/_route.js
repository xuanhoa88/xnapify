/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import reducer, { SLICE_NAME } from '../redux';
import Users from './Users';
import {
  addBreadcrumb,
  registerMenu,
  unregisterMenu,
} from '../../../../../../shared/renderer/redux';
import { requirePermission } from '../../../../../../shared/renderer/components/Rbac';

export const middleware = requirePermission('users:read');

/**
 * Register menu item for this route
 */
export function register({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      item: {
        ns: i18n.t('navigation.management', 'Management'),
        path: '/admin/users',
        label: i18n.t('navigation.users', 'Users'),
        icon: 'users',
        permission: 'users:read',
        order: 10,
      },
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
      path: '/admin/users',
    }),
  );
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('navigation.users', 'Users'),
  };
}

/**
 * Boot function - inject Redux slice
 */
export function boot({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      { label: i18n.t('navigation.users', 'Users'), url: path },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default Users;
