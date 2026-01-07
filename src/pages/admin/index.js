/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import AdminLayout from '../../components/Admin';
import { isAuthenticated } from '../../redux';

// Lazy load children pages context
const pagesContext = require.context('./', true, /^\.\/[^/]+\/index\.js$/);

/**
 * Admin page factory
 */
const route = async buildPages => {
  const children = await buildPages(pagesContext);

  return {
    path: '/admin',
    autoDelegate: false,
    children,
  };
};

/**
 * Admin route action
 */
async function action(context) {
  // Auth check
  const state = context.store.getState();
  if (!isAuthenticated(state)) {
    return { redirect: '/login' };
  }

  // Delegate to child routes
  const nextPage = await context.next();
  if (!nextPage || !nextPage.component) {
    return { redirect: '/not-found' };
  }

  // Build breadcrumb: Dashboard + route breadcrumbs
  const breadcrumb = [
    { label: context.i18n.t('navigation.dashboard', 'Dashboard') },
    ...(nextPage.breadcrumbs || []),
  ];

  return {
    title: nextPage.title || context.i18n.t('navigation.admin', 'Admin Panel'),
    breadcrumb,
    component: <AdminLayout>{nextPage.component}</AdminLayout>,
  };
}

export default [route, action];
