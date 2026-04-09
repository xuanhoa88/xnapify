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

import reducer, { SLICE_NAME } from '../redux';

import SettingsPage from './SettingsPage';

/**
 * Route boot — inject Redux reducer into the store.
 */
export function init({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

export const middleware = requirePermission('settings:read');

/**
 * Register menu item for this route
 */
export function setup({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      id: 'system',
      label: i18n.t('admin:navigation.system', 'System'),
      order: 90,
      icon: 'sliders',
      items: [
        {
          path: '/admin/settings',
          label: i18n.t('admin:navigation.settings', 'Settings'),
          icon: 'settings',
          permission: 'settings:read',
          order: 10,
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
      path: '/admin/settings',
    }),
  );
}

/**
 * Page metadata
 */

export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.settings', 'Settings'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.settings', 'Settings'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default SettingsPage;
