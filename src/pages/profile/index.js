/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import { isAuthenticated } from '../../redux';
import Profile from './Profile';

/**
 * Route configuration
 */
const route = {
  path: '/profile',
};

/**
 * Route action
 * Redirects authenticated users to home page
 */
function action(context) {
  const title = context.i18n.t('navigation.profile', 'Profile');

  if (!isAuthenticated(context.store.getState())) {
    return { redirect: '/login' };
  }

  return {
    title,
    component: (
      <Layout>
        <Profile title={title} />
      </Layout>
    ),
  };
}

export default [route, action];
