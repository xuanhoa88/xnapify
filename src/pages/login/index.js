/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isAuthenticated } from '../../redux';
import Login from './Login';

/**
 * Route configuration
 * Redirects authenticated users to home page
 * Renders login page standalone without header/footer
 */
export default {
  path: '/login',

  action(context) {
    // Get title for SSR page metadata
    const title = context.i18n.t('navigation.login', 'Log In');

    // Get state from Redux store
    const state = context.store.getState();

    // Redirect authenticated users to home
    if (isAuthenticated(state)) {
      return { redirect: '/' };
    }

    return {
      title,
      component: <Login />,
    };
  },
};
