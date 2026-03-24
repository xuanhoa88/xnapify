/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { addBreadcrumb } from '@shared/renderer/redux';

import reducer, { SLICE_NAME } from '../redux';

/**
 * Admin index route - redirects to dashboard
 */
export function middleware() {
  return { redirect: '/admin/emails/templates' };
}

/**
 * Route init — inject Redux reducer into the store.
 */
export function init({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Mount function - reset breadcrumbs for admin routes
 * Runs on every admin route navigation to reset breadcrumbs
 */
export function mount({ store, i18n }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.notifications', 'Notifications'),
        url: '/admin/notifications',
      },
      'admin',
    ),
  );
}
