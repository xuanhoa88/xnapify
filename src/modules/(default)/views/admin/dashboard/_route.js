/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import reducer, { SLICE_NAME } from './redux';
import Dashboard from './Dashboard';

/**
 * Init function - inject Redux slice
 */
export function init({ store }) {
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
