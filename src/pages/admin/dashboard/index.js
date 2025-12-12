/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Dashboard from './Dashboard';

/**
 * Route configuration
 * path: '/' matches when parent /admin is accessed directly (index route)
 * priority: 100 ensures this is matched before other child routes
 */
const route = {
  path: '/',
  priority: 100,
};

/**
 * Route action
 * Authentication and authorization handled by parent route
 */
async function action() {
  const title = 'Dashboard';

  return {
    title,
    component: <Dashboard />,
  };
}

export default [route, action];
