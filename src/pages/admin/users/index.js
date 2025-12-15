/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Users from './Users';
import CreateUser from './create/CreateUser';
import EditUser from './edit/EditUser';

/**
 * Route configuration with child routes
 */
const route = {
  path: '/users',
  children: [
    {
      path: '',
      action: () => ({
        title: 'User Management - Admin',
        component: <Users />,
      }),
    },
    {
      path: '/create',
      action: () => ({
        title: 'Create User - Admin',
        component: <CreateUser />,
      }),
    },
    {
      path: '/:userId/edit',
      action: context => ({
        title: 'Edit User - Admin',
        component: <EditUser userId={context.params.userId} />,
      }),
    },
  ],
};

/**
 * Route action
 * Authentication and authorization handled by parent route
 */
async function action(context) {
  // Delegate to child routes
  return context.next();
}

export default [route, action];
