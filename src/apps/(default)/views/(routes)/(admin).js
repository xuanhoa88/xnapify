/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isAuthenticated, setBreadcrumbs } from '@shared/renderer/redux';

/**
 * Admin route config
 *
 * Applied to all routes starting with /admin
 * Ensures only authenticated users can access admin pages
 */

/**
 * Mount function - reset breadcrumbs for admin routes
 * Runs on every admin route navigation to reset breadcrumbs
 */
export function mount({ store, i18n }) {
  store.dispatch(
    setBreadcrumbs({
      admin: [
        {
          label: i18n.t('admin:navigation.dashboard', 'Dashboard'),
          url: '/admin',
        },
      ],
    }),
  );
}

/**
 * Authentication middleware for admin routes
 * Redirects unauthenticated users to login
 */
export function middleware({ store, pathname }, next) {
  const state = store.getState();
  if (!isAuthenticated(state)) {
    return { redirect: `/login?returnTo=${encodeURIComponent(pathname)}` };
  }
  return next();
}
