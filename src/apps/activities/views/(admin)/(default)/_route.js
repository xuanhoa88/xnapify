/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Admin Route
 */

import { requirePermission } from '@shared/renderer/components/Rbac';
import {
  addBreadcrumb,
  registerMenu,
  unregisterMenu,
} from '@shared/renderer/redux';

import reducer, { SLICE_NAME } from '../redux';

import ActivityList from './ActivityList';

export const middleware = requirePermission('activities:read');

/**
 * Register menu item
 */
export function register({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      id: 'monitoring',
      label: i18n.t('admin:navigation.monitoring', 'Monitoring'),
      order: 30, // After Management
      items: [
        {
          path: '/admin/activities',
          label: i18n.t('admin:navigation.activities', 'Activity Logs'),
          icon: 'activity',
          permission: 'activities:read',
          order: 10,
        },
      ],
    }),
  );
}

/**
 * Unregister menu item
 */
export function unregister({ store }) {
  store.dispatch(
    unregisterMenu({
      ns: 'admin',
      path: '/admin/activities',
    }),
  );
}

/**
 * Init Redux
 */
export function init({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.activities', 'Activity Logs'),
  };
}

/**
 * Mount breadcrumb
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.activities', 'Activity Logs'),
        url: path,
      },
      'admin',
    ),
  );
}

export default ActivityList;
