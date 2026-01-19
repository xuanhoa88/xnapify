/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import reducer, { SLICE_NAME } from './redux';
import Roles from './routes/Roles';
import CreateRole from './routes/create/CreateRole';
import EditRole from './routes/edit/EditRole';

/**
 * Route configuration with child routes
 */
export default {
  path: '/roles',

  // One-time initialization - inject Redux slice
  boot: ({ store }) => {
    store.injectReducer(SLICE_NAME, reducer);
  },

  mount: () => ({
    breadcrumb: { label: 'Roles' },
  }),

  children: [
    {
      path: '',
      action() {
        return {
          title: 'Role Management',
          component: <Roles />,
        };
      },
    },
    {
      path: '/create',
      action() {
        return {
          title: 'Create Role',
          breadcrumb: { label: 'Create' },
          component: <CreateRole />,
        };
      },
    },
    {
      path: '/:roleId/edit',
      action({ params }) {
        return {
          title: 'Edit Role',
          breadcrumb: { label: 'Edit' },
          component: <EditRole roleId={params.roleId} />,
        };
      },
    },
  ],
};
