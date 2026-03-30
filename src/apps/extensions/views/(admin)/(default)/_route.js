/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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

import Extensions from './Extensions';
import reducer, { SLICE_NAME } from './redux';

export const middleware = requirePermission('extensions:read');

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
      id: 'extensions',
      label: i18n.t('admin:navigation.extensionsGroup', 'Extensions'),
      order: 90,
      icon: 'extension',
      items: [
        {
          path: '/admin/extensions/hub',
          label: i18n.t('admin:navigation.hub', 'Hub'),
          icon: 'globe',
          permission: 'extensions:read',
          order: 10,
        },
        {
          path: '/admin/extensions',
          label: i18n.t('admin:navigation.extensions', 'Manage'),
          icon: 'extension',
          permission: 'extensions:read',
          order: 20,
          exact: true,
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
      path: '/admin/extensions',
    }),
  );
  store.dispatch(
    unregisterMenu({
      ns: 'admin',
      path: '/admin/extensions/hub',
    }),
  );
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.extensions', 'Extensions'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.extensions', 'Extensions'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default Extensions;
