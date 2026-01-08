/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Roles from './routes/Roles';
import CreateRole from './routes/create/CreateRole';
import EditRole from './routes/edit/EditRole';
import reducer, { SLICE_NAME } from './redux';

/**
 * Route configuration with child routes
 */
const route = {
  path: '/roles',

  // One-time initialization - inject Redux slice
  init: ({ store }) => {
    store.injectReducer(SLICE_NAME, reducer);
  },

  // Dynamic metadata
  metadata: ({ i18n }) => ({
    breadcrumb: { label: i18n.t('admin.roles.title', 'Roles') },
  }),

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
      metadata: ({ i18n }) => ({
        breadcrumb: { label: i18n.t('admin.roles.create', 'Create') },
      }),
      action: () => ({
        title: 'Create Role - Admin',
        component: <CreateRole />,
      }),
    },
    {
      path: '/:roleId/edit',
      metadata: ({ i18n }) => ({
        breadcrumb: { label: i18n.t('admin.roles.edit', 'Edit') },
      }),
      action: ({ params }) => ({
        title: 'Edit Role - Admin',
        component: <EditRole roleId={params.roleId} />,
      }),
    },
  ],
};

export default [route];
