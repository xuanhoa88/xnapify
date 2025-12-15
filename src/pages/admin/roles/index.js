/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Roles from './Roles';
import CreateRole from './create/CreateRole';
import EditRole from './edit/EditRole';

/**
 * Route configuration with child routes
 */
const route = {
  path: '/roles',
  children: [
    {
      path: '',
      action: () => ({
        title: 'Role Management - Admin',
        component: <Roles />,
      }),
    },
    {
      path: '/create',
      action: () => ({
        title: 'Create Role - Admin',
        component: <CreateRole />,
      }),
    },
    {
      path: '/:roleId/edit',
      action: context => ({
        title: 'Edit Role - Admin',
        component: <EditRole roleId={context.params.roleId} />,
      }),
    },
  ],
};

export default [route];
