/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { requirePermission } from '@shared/renderer/components/Rbac';
import {
  addBreadcrumb,
  registerMenu,
  unregisterMenu,
} from '@shared/renderer/redux';

import reducer, { SLICE_NAME } from '../redux';

import Groups from './Groups';

export const middleware = requirePermission('groups:read');

/**
 * Route boot — inject Redux reducer into the store.
 */
export function boot({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Register menu item for this route
 */
export function register({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      id: 'identity-access',
      label: i18n.t('admin:navigation.identityAccess', 'Identity & Access'),
      order: 10,
      icon: 'shield',
      items: [
        {
          path: '/admin/groups',
          label: i18n.t('admin:navigation.groups', 'Groups'),
          icon: 'folder',
          permission: 'groups:read',
          order: 20,
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
      path: '/admin/groups',
    }),
  );
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.groups', 'Groups'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.groups', 'Groups'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default Groups;
