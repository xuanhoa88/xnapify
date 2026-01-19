/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import reducer, { SLICE_NAME } from './redux';
import Permissions from './routes/Permissions';
import CreatePermission from './routes/create/CreatePermission';
import EditPermission from './routes/edit/EditPermission';

/**
 * Route configuration
 */
export default {
  path: '/permissions',

  // One-time initialization - inject Redux slice
  boot: ({ store }) => {
    store.injectReducer(SLICE_NAME, reducer);
  },

  mount: () => ({
    breadcrumb: { label: 'Permissions' },
  }),

  children: [
    {
      path: '',
      action() {
        return {
          title: 'Permission Management',
          component: <Permissions />,
        };
      },
    },
    {
      path: '/create',
      action() {
        return {
          title: 'Create Permission',
          breadcrumb: { label: 'Create' },
          component: <CreatePermission />,
        };
      },
    },
    {
      path: '/:permissionId/edit',
      action({ params }) {
        return {
          title: 'Edit Permission',
          breadcrumb: { label: 'Edit' },
          component: <EditPermission permissionId={params.permissionId} />,
        };
      },
    },
  ],
};
