/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import ErrorPage from './ErrorPage';

/**
 * Page metadata
 */
export async function getInitialProps({ i18n, error }) {
  return {
    title: i18n.t('navigation.error', 'Error'),
    error,
  };
}

/**
 * Default export - Page component
 * Development only - renders error page standalone
 */
export default ErrorPage;
