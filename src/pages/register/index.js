/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import { isAuthenticated } from '../../redux';
import Register from './Register';

/**
 * Route configuration
 */
const route = {
  path: '/register',
};

/**
 * Route action
 * Redirects authenticated users to home page
 */
function action(context) {
  const title = context.i18n.t('navigation.register', 'Register');

  // Get state from Redux store
  const state = context.store.getState();

  // Redirect authenticated users to home
  if (isAuthenticated(state)) {
    return { redirect: '/' };
  }

  return {
    title,
    component: (
      <Layout>
        <Register title={title} />
      </Layout>
    ),
  };
}

export default [route, action];
