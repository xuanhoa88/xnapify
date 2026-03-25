/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Dashboard from './Dashboard';
import reducer, { SLICE_NAME } from './redux';

/**
 * Route boot — inject Redux reducer into the store.
 */
export function boot({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.dashboard', 'Dashboard'),
  };
}

/**
 * Default export - Page component
 */
export default Dashboard;
