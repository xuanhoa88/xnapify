/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Users from './Users';

/**
 * Route configuration
 */
const route = {
  path: '/users',
};

/**
 * Route action
 * Authentication and authorization handled by parent route
 */
async function action() {
  const title = 'User Management - Admin';

  return {
    title,
    component: <Users />,
  };
}

export default [route, action];
