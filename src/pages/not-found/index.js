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
 * Renders not-found page standalone without header/footer
 */
export default {
  path: '/*path',
  priority: 0,

  action() {
    return {
      title: 'Page Not Found',
      component: <NotFound />,
      status: 404,
    };
  },
};
