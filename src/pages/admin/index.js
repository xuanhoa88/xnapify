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
const route = async pageBuilder => {
  const children = await pageBuilder(pagesContext);

  return {
    children,
    path: '/admin',
    autoDelegate: false,
    breadcrumb: context => ({
      label: context.i18n.t('navigation.dashboard', 'Dashboard'),
    }),
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
  const childPage = await context.next();
  if (!childPage || !childPage.component) {
    return { redirect: '/not-found' };
  }

  return {
    ...childPage,
    title: childPage.title || context.i18n.t('navigation.admin', 'Admin Panel'),
    component: <AdminLayout>{childPage.component}</AdminLayout>,
  };
}

export default [route, action];
