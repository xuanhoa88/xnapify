/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import NotFound from './NotFound';

/**
 * Route configuration
 * Catch-all route with lowest priority for 404 pages
 */
const route = {
  path: '/*path',
  priority: 0,
};

/**
 * Route action (404)
 * Renders not-found page standalone without header/footer
 */
function action() {
  return {
    title: 'Page Not Found',
    component: <NotFound />,
    status: 404,
  };
}

export default [route, action];
