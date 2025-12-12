/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import { isAuthenticated } from '../../redux';
import Profile from './Profile';
import EmailVerification from './EmailVerification';

/**
 * Route configuration with child routes
 */
const route = {
  path: '/profile',
  children: [
    {
      path: '',
      action: context => {
        const title = context.i18n.t('navigation.profile', 'User Profile');

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
      },
    },
    {
      path: '/:token/email-verification',
      action: context => {
        const title = 'Email Verification';
        const state = context.store.getState();

        // Redirect authenticated users to home
        if (isAuthenticated(state)) {
          return { redirect: '/' };
        }

        const { token } = context.params;

        return {
          title,
          component: (
            <Layout>
              <EmailVerification title={title} token={token} />
            </Layout>
          ),
        };
      },
    },
  ],
};

export default [route];
