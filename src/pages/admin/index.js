/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import { isAuthenticated, setAdminPanel } from '../../redux';

// Lazy load children routes context
const pagesContext = require.context('./', true, /^\.\/[^/]+\/index\.js$/);

/**
 * Admin route factory - async to allow pre-building children
 * This ensures children are populated BEFORE the router evaluates them
 */
const route = async buildRoutes => {
  // Build children routes
  const children = await buildRoutes(pagesContext);

  // Return admin route configuration
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

  // Return admin route action
  return {
    title,
    component: <Layout>{childResult && childResult.component}</Layout>,
  };
}

export default [route, action];
