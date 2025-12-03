/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Roles from './Roles';

/**
 * Route configuration
 */
const route = {
  path: '/roles',
};

/**
 * Route action
 * Authentication and authorization handled by parent route
 */
async function action() {
  const title = 'Role Management - Admin';

  return {
    title,
    component: <Roles />,
  };
}

export default [route, action];
