/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import AdminLayout from '../../components/Admin';
import { isAuthenticated, setAdminPanel } from '../../redux';

// Lazy load children pages context
const pagesContext = require.context('./', true, /^\.\/[^/]+\/index\.js$/);

/**
 * Admin page factory - async to allow pre-building children
 * This ensures children are populated BEFORE the navigator evaluates them
 */
const route = async buildPages => {
  // Build children pages
  const children = await buildPages(pagesContext);

  // Return admin page configuration
  return {
    path: '/admin',
    autoDelegate: false,
    children,
  };
};

async function action(context) {
  // Auth check first
  const state = context.store.getState();
  if (!isAuthenticated(state)) {
    return { redirect: '/login' };
  }

  // Set admin panel state
  context.store.dispatch(setAdminPanel(true));

  // Now context.next() works because children were pre-populated
  const childResult = await context.next();

  // Set page title
  const title =
    (childResult && childResult.title) ||
    context.i18n.t('navigation.admin', 'Admin Panel');

  // Return admin page action
  return {
    title,
    component: (
      <AdminLayout>{childResult && childResult.component}</AdminLayout>
    ),
  };
}

export default [route, action];
