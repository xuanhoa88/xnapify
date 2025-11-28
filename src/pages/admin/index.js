/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import { isAuthenticated, isAdmin } from '../../redux';
import Admin from './Admin';

/**
 * Route configuration
 */
const route = {
  path: '/admin',
};

/**
 * Route action
 * Requires authentication and admin role
 */
async function action(context) {
  const title = 'Admin Dashboard';

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

  return {
    title,
    component: (
      <Layout>
        <Admin title={title} />
      </Layout>
    ),
  };
}

export default [route, action];
