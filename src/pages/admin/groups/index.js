/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Groups from './routes/Groups';
import CreateGroup from './routes/create/CreateGroup';
import EditGroup from './routes/edit/EditGroup';
import reducer, { SLICE_NAME } from './redux';

/**
 * Route configuration with child routes
 */
export default {
  path: '/groups',

  // One-time initialization - inject Redux slice
  boot: ({ store }) => {
    store.injectReducer(SLICE_NAME, reducer);
  },

  mount: () => ({
    breadcrumb: { label: 'Groups' },
  }),

  children: [
    {
      path: '',
      action() {
        return {
          title: 'Group Management',
          component: <Groups />,
        };
      },
    },
    {
      path: '/create',
      action() {
        return {
          title: 'Create Group',
          breadcrumb: { label: 'Create' },
          component: <CreateGroup />,
        };
      },
    },
    {
      path: '/:groupId/edit',
      title: 'Edit Group',
      action({ params }) {
        return {
          title: 'Edit Group',
          breadcrumb: { label: 'Edit' },
          component: <EditGroup groupId={params.groupId} />,
        };
      },
    },
  ],
};
