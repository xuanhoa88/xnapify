/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { features } from '@shared/renderer/redux';
const { isAuthenticated } = features;

import ResetPasswordConfirmation from './ResetPasswordConfirmation';

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t(
      'navigation.resetPasswordConfirmation',
      'Reset Password Confirmation',
    ),
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
export default ResetPasswordConfirmation;
