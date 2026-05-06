/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { features } from '@shared/renderer/redux/index.js';

import Dashboard from './Dashboard.js';

// Load dashboard translations
const translationsContext = import.meta.webpackContext('./translations', {
  recursive: false,
  regExp: /\.json$/i,
});

export function translations() {
  return translationsContext;
}

const { registerMenu, unregisterMenu } = features;

/**
 * Register menu item
 */
export function setup({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: i18n.t('admin:navigation.main', 'Main'),
      id: 'main',
      label: i18n.t('admin:navigation.main', 'Main'),
      order: 0, // First section
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
}

/**
 * Unregister menu item
 */
export function teardown({ store, i18n }) {
  store.dispatch(
    unregisterMenu({
      ns: i18n.t('admin:navigation.main', 'Main'),
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
