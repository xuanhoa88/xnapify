/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isAuthenticated } from '../../redux';
import Register from './Register';
import EmailVerification from './EmailVerification';

/**
 * Route configuration
 * Renders register pages standalone without header/footer
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
          component: <Register />,
        };
      },
    },
    {
      path: '/:token/email-verification',
      action: context => {
        const title = context.i18n.t(
          'emailVerification.title',
          'Email Verification',
        );
        const state = context.store.getState();

        // Redirect authenticated users to home
        if (isAuthenticated(state)) {
          return { redirect: '/' };
        }

        const { token } = context.params;

        return {
          title,
          component: <EmailVerification token={token} />,
        };
      },
    },
  ],
};

export default [route];
