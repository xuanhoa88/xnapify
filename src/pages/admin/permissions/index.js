/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Permissions from './Permissions';

/**
 * Route configuration
 */
const route = {
  path: '/permissions',
};

/**
 * Route action
 * Authentication and authorization handled by parent route
 */
async function action() {
  const title = 'Permission Management - Admin';

  return {
    title,
    component: <Permissions />,
  };
}

export default [route, action];
