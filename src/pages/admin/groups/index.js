/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Groups from './Groups';

/**
 * Route configuration
 */
const route = {
  path: '/groups',
};

/**
 * Route action
 * Authentication and authorization handled by parent route
 */
async function action() {
  const title = 'Group Management - Admin';

  return {
    title,
    component: <Groups />,
  };
}

export default [route, action];
