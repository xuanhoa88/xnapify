/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import { isAuthenticated } from '../../redux';
import RequestResetPassword from './RequestResetPassword';
import ResetPasswordConfirmation from './ResetPasswordConfirmation';

/**
 * Route configuration with child routes
 */
const route = {
  path: '/reset-password',
  children: [
    {
      path: '',
      action: context => {
        const title = 'Request Reset Password';
        const state = context.store.getState();

        if (isAuthenticated(state)) {
          return { redirect: '/' };
        }

        return {
          title,
          component: (
            <Layout>
              <RequestResetPassword title={title} />
            </Layout>
          ),
        };
      },
    },
    {
      path: '/:token/confirmation',
      action: context => {
        const title = 'Reset Password Confirmation';
        const state = context.store.getState();

        if (isAuthenticated(state)) {
          return { redirect: '/' };
        }

        const { token } = context.params;

        return {
          title,
          component: (
            <Layout>
              <ResetPasswordConfirmation title={title} token={token} />
            </Layout>
          ),
        };
      },
    },
  ],
};

export default [route];
