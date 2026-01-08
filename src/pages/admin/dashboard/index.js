/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Dashboard from './routes/Dashboard';
import reducer, { SLICE_NAME } from './redux';

/**
 * Route configuration
 * path: '/' matches when parent /admin is accessed directly (index route)
 * priority: 100 ensures this is matched before other child routes
 * Authentication and authorization handled by parent route
 */
export default {
  path: '/',
  priority: 100,

  // One-time initialization - inject Redux slice
  // No additional breadcrumb needed - admin provides Dashboard
  boot: ({ store }) => {
    store.injectReducer(SLICE_NAME, reducer);
  },

  action() {
    return {
      title: 'Dashboard',
      component: <Dashboard />,
    };
  },
};
