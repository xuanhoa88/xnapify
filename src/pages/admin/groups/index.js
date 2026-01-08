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
const route = {
  path: '/groups',

  // One-time initialization - inject Redux slice
  init: ({ store }) => {
    store.injectReducer(SLICE_NAME, reducer);
  },

  // Dynamic metadata
  metadata: ({ i18n }) => ({
    breadcrumb: { label: i18n.t('admin.groups.title', 'Groups') },
  }),

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
      metadata: ({ i18n }) => ({
        breadcrumb: { label: i18n.t('admin.groups.create', 'Create') },
      }),
      action: () => ({
        title: 'Create Group - Admin',
        component: <CreateGroup />,
      }),
    },
    {
      path: '/:groupId/edit',
      metadata: ({ i18n }) => ({
        breadcrumb: { label: i18n.t('admin.groups.edit', 'Edit') },
      }),
      action: ({ params }) => ({
        title: 'Edit Group - Admin',
        component: <EditGroup groupId={params.groupId} />,
      }),
    },
  ],
};

export default [route];
