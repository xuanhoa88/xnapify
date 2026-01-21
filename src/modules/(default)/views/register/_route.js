/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isAuthenticated } from '../../../../shared/renderer/redux';
import Register from './Register';

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('navigation.register', 'Register'),
  };
}

/**
 * Guard function - redirect authenticated users
 */
// Middleware to redirect if ALREADY authenticated
export async function middleware(context, next) {
  const { store } = context;
  const state = store.getState();
  if (isAuthenticated(state)) {
    return { redirect: '/' };
  }
  return next();
}

/**
 * Default export - Page component
 */
export default Register;
