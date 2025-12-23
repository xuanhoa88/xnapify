/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import ErrorPage from './ErrorPage';

/**
 * Route configuration
 */
const route = {
  path: '/error',
  devOnly: true,
};

/**
 * Route action (Development only)
 * Renders error page standalone without header/footer
 */
function action() {
  return {
    title: 'Error',
    component: <ErrorPage />,
  };
}

export default [route, action];
