/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import { isAuthenticated } from '../../redux';
import Register from './Register';
import EmailVerification from './EmailVerification';

/**
 * Route configuration
 */
const route = {
  path: '/register',
  children: [
    {
      path: '',
      action: context => {
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
              <Register />
            </Layout>
          ),
        };
      },
    },
    {
      path: '/:token/email-verification',
      action: context => {
        const title = context.i18n.t(
          'emailVerification.title',
          'Email Verification',
        ); // Localized string should be used in real app
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
              <EmailVerification token={token} />
            </Layout>
          ),
        };
      },
    },
  ],
};

export default [route];
