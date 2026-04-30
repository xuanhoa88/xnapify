/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { features } from '@shared/renderer/redux';

import Dashboard from './Dashboard';

const { registerMenu, unregisterMenu } = features;

/**
 * Register menu item
 */
export function setup({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      id: 'dashboard',
      label: i18n.t('admin:navigation.dashboard', 'Dashboard'),
      order: 1, // First item
      icon: 'HomeIcon',
      items: [
        {
          path: '/admin',
          label: i18n.t('admin:navigation.home', 'Home'),
          icon: 'HomeIcon',
          order: 10,
        },
      ],
    }),
  );
}

/**
 * Unregister menu item
 */
export function teardown({ store }) {
  store.dispatch(
    unregisterMenu({
      ns: 'admin',
      path: '/admin',
    }),
  );
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.dashboard', 'Dashboard'),
  };
}

export default Dashboard;
