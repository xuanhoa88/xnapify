/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */


import { requirePermission } from '@shared/renderer/components/Rbac';
import { features } from '@shared/renderer/redux';
const { addBreadcrumb, registerMenu, unregisterMenu } = features;

import reducer, { SLICE_NAME } from '../redux';

import Permissions from './Permissions';

export const middleware = requirePermission('permissions:read');

/**
 * Route boot — inject Redux reducer into the store.
 */
export function init({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Register menu item for this route
 */
export function setup({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      id: 'identity-access',
      label: i18n.t('admin:navigation.identityAccess', 'Identity & Access'),
      order: 10,
      icon: 'LockClosedIcon',
      items: [
        {
          path: '/admin/permissions',
          label: i18n.t('admin:navigation.permissions', 'Permissions'),
          icon: 'LockOpen1Icon',
          permission: 'permissions:read',
          order: 40,
        },
      ],
    }),
  );
}

/**
 * Unregister menu item for this route
 */
export function teardown({ store }) {
  store.dispatch(
    unregisterMenu({
      ns: 'admin',
      path: '/admin/permissions',
    }),
  );
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.permissions', 'Permissions'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.permissions', 'Permissions'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default Permissions;
