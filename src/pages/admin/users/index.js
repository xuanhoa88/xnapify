/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Users from './routes/Users';
import CreateUser from './routes/create/CreateUser';
import EditUser from './routes/edit/EditUser';
import reducer, { SLICE_NAME } from './redux';

/**
 * Route configuration with child routes
 */
const route = {
  path: '/users',

  // One-time initialization - inject Redux slice
  init: ({ store }) => {
    store.injectReducer(SLICE_NAME, reducer);
  },

  // Dynamic metadata
  metadata: ({ i18n }) => ({
    breadcrumb: { label: i18n.t('admin.users.title', 'Users') },
  }),

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
      metadata: ({ i18n }) => ({
        breadcrumb: { label: i18n.t('admin.users.create', 'Create') },
      }),
      action: () => ({
        title: 'Create User - Admin',
        component: <CreateUser />,
      }),
    },
    {
      path: '/:userId/edit',
      metadata: ({ i18n }) => ({
        breadcrumb: { label: i18n.t('admin.users.edit', 'Edit') },
      }),
      action: ({ params }) => ({
        title: 'Edit User - Admin',
        component: <EditUser userId={params.userId} />,
      }),
    },
  ],
};

export default [route];
