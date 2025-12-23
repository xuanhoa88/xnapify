/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isAuthenticated } from '../../redux';
import RequestResetPassword from './RequestResetPassword';
import ResetPasswordConfirmation from './ResetPasswordConfirmation';

/**
 * Route configuration with child routes
 * Renders reset password pages standalone without header/footer
 */
const route = {
  path: '/reset-password',
  children: [
    {
      path: '',
      action: context => {
        const title = context.i18n.t(
          'resetPassword.title',
          'Request Reset Password',
        );
        const state = context.store.getState();

        if (isAuthenticated(state)) {
          return { redirect: '/' };
        }

        return {
          title,
          component: <RequestResetPassword />,
        };
      },
    },
    {
      path: '/:token/confirmation',
      action: context => {
        const title = context.i18n.t(
          'resetPasswordConfirmation.title',
          'Reset Password Confirmation',
        );
        const state = context.store.getState();

        if (isAuthenticated(state)) {
          return { redirect: '/' };
        }

        const { token } = context.params;

        return {
          title,
          component: <ResetPasswordConfirmation token={token} />,
        };
      },
    },
  ],
};

export default [route];
