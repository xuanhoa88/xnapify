/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { isAuthenticated } from '../../../../../../shared/renderer/redux';
import ResetPasswordConfirmation from '../../ResetPasswordConfirmation';

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
export default function ResetPasswordConfirmationPage({ context: { params } }) {
  const { token } = params;
  return <ResetPasswordConfirmation token={token} />;
}

ResetPasswordConfirmationPage.propTypes = {
  context: PropTypes.shape({
    params: PropTypes.shape({
      token: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};
