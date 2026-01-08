/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Permissions from './routes/Permissions';
import CreatePermission from './routes/create/CreatePermission';
import EditPermission from './routes/edit/EditPermission';
import reducer, { SLICE_NAME } from './redux';

/**
 * Route configuration
 */
const route = {
  path: '/permissions',

  // One-time initialization - inject Redux slice
  init: ({ store }) => {
    store.injectReducer(SLICE_NAME, reducer);
  },

  // Dynamic metadata
  metadata: ({ i18n }) => ({
    breadcrumb: { label: i18n.t('admin.permissions.title', 'Permissions') },
  }),

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
      metadata: ({ i18n }) => ({
        breadcrumb: { label: i18n.t('admin.permissions.create', 'Create') },
      }),
      action: () => ({
        title: 'Create Permission - Admin',
        component: <CreatePermission />,
      }),
    },
    {
      path: '/:permissionId/edit',
      metadata: ({ i18n }) => ({
        breadcrumb: { label: i18n.t('admin.permissions.edit', 'Edit') },
      }),
      action: ({ params }) => ({
        title: 'Edit Permission - Admin',
        component: <EditPermission permissionId={params.permissionId} />,
      }),
    },
  ],
};

export default [route];
