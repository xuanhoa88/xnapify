/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isAuthenticated } from '@shared/renderer/redux';

import ResetPasswordRequest from './ResetPasswordRequest';

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('navigation.resetPassword', 'Reset Password'),
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
export const layout = false;

/**
 * Default export - Page component
 */
export default ResetPasswordRequest;
