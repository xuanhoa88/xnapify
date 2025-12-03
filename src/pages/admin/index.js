/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import { isAuthenticated, isAdmin, setAdminPanel } from '../../redux';
import Admin from './Admin';

// Lazy load children routes
const pagesContext = require.context('./', true, /^\.\/[^/]+\/index\.js$/);

/**
 * Route configuration
 * autoDelegate: false because we manually wrap children in the action
 * children: initialized as empty array, will be populated lazily in action
 */
const route = {
  path: '/admin',
  autoDelegate: false,
  children: [],
};

/**
 * Route action
 * Requires authentication and admin role
 */
async function action(context) {
  // Build child routes if not already built
  if (
    Array.isArray(context.route.children) &&
    context.route.children.length === 0
  ) {
    const pageRoutes = await context.buildRoutes(pagesContext);
    context.route.children = pageRoutes.length === 0 ? null : pageRoutes;
  }

  // Set admin route state in Redux
  context.store.dispatch(setAdminPanel(true));

  // Get state from Redux store
  const state = context.store.getState();

  // Check if user is authenticated
  if (!isAuthenticated(state)) {
    return { redirect: '/login' };
  }

  // Check if user has admin role
  if (!isAdmin(state)) {
    return { redirect: '/', status: 403 };
  }

  // Try to match child routes first
  const childResult = await context.next();

  // If a child route matched and has a component, wrap it with the Admin layout
  if (childResult && childResult.component) {
    return {
      ...childResult,
      component: (
        <Layout>
          <Admin title={childResult.title} currentPath={context.pathname}>
            {childResult.component}
          </Admin>
        </Layout>
      ),
    };
  }

  // No child route matched, render the default dashboard
  const title = context.i18n.t('navigation.admin', 'Admin Panel');
  return {
    title,
    component: (
      <Layout>
        <Admin title={title} currentPath={context.pathname} />
      </Layout>
    ),
  };
}

export default [route, action];
