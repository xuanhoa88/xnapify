/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isAuthenticated } from '@shared/renderer/redux';

import Login from './Login';

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('navigation.login', 'Log In'),
  };
}

/**
 * Guard function - redirect authenticated users
 */
export async function middleware(context, next) {
  const { store, query } = context;
  const state = store.getState();
  if (isAuthenticated(state)) {
    return { redirect: query.returnTo || '/' };
  }
  return next();
}

/**
 * Route config
 */
export const layout = 'unauth';

/**
 * Default export - Page component
 */
export default Login;
