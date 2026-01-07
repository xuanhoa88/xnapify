/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Permissions from './Permissions';
import CreatePermission from './create/CreatePermission';
import EditPermission from './edit/EditPermission';

/**
 * Route configuration
 */
const route = {
  path: '/permissions',
  breadcrumb: { label: 'Permissions' },
  children: [
    {
      path: '',
      action: () => ({
        title: 'Permission Management - Admin',
        component: <Permissions />,
      }),
    },
    {
      path: '/create',
      breadcrumb: { label: 'Create' },
      action: () => ({
        title: 'Create Permission - Admin',
        component: <CreatePermission />,
      }),
    },
    {
      path: '/:permissionId/edit',
      breadcrumb: { label: 'Edit' },
      action: context => ({
        title: 'Edit Permission - Admin',
        component: (
          <EditPermission permissionId={context.params.permissionId} />
        ),
      }),
    },
  ],
};

export default [route];
