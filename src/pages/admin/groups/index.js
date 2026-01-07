/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Groups from './Groups';
import CreateGroup from './create/CreateGroup';
import EditGroup from './edit/EditGroup';

/**
 * Route configuration with child routes
 */
const route = {
  path: '/groups',
  breadcrumb: { label: 'Groups' },
  children: [
    {
      path: '',
      action: () => ({
        title: 'Group Management - Admin',
        component: <Groups />,
      }),
    },
    {
      path: '/create',
      breadcrumb: { label: 'Create' },
      action: () => ({
        title: 'Create Group - Admin',
        component: <CreateGroup />,
      }),
    },
    {
      path: '/:groupId/edit',
      breadcrumb: { label: 'Edit' },
      action: context => ({
        title: 'Edit Group - Admin',
        component: <EditGroup groupId={context.params.groupId} />,
      }),
    },
  ],
};

export default [route];
