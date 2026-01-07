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
  breadcrumb: { label: 'Users' },
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
      breadcrumb: { label: 'Create' },
      action: () => ({
        title: 'Create User - Admin',
        component: <CreateUser />,
      }),
    },
    {
      path: '/:userId/edit',
      breadcrumb: { label: 'Edit' },
      action: context => ({
        title: 'Edit User - Admin',
        component: <EditUser userId={context.params.userId} />,
      }),
    },
  ],
};

export default [route];
