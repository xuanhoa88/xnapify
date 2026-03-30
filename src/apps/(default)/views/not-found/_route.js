/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import NotFound from './NotFound';

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('navigation.notFound', 'Page Not Found'),
    status: 404,
  };
}

/**
 * Route config
 */
export const layout = false;

/**
 * Default export - Page component
 * Catch-all route for 404 pages
 */
export default NotFound;
