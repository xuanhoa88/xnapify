/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import reducer, { SLICE_NAME } from './redux';
import Users from './routes/Users';
import CreateUser from './routes/create/CreateUser';
import EditUser from './routes/edit/EditUser';

/**
 * Route configuration with child routes
 */
export default {
  path: '/users',

  // One-time initialization - inject Redux slice
  boot: ({ store }) => {
    store.injectReducer(SLICE_NAME, reducer);
  },

  mount: () => ({
    breadcrumb: { label: 'Users' },
  }),

  children: [
    {
      path: '',
      action() {
        return {
          title: 'User Management',
          component: <Users />,
        };
      },
    },
    {
      path: '/create',
      action() {
        return {
          title: 'Create User',
          breadcrumb: { label: 'Create' },
          component: <CreateUser />,
        };
      },
    },
    {
      path: '/:userId/edit',
      action({ params }) {
        return {
          title: 'Edit User',
          breadcrumb: { label: 'Edit' },
          component: <EditUser userId={params.userId} />,
        };
      },
    },
  ],
};
