/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Dashboard from './Dashboard.js';

// Load dashboard translations
const translationsContext = import.meta.webpackContext('./translations', {
  recursive: false,
  regExp: /\.json$/i,
});

export function translations() {
  return translationsContext;
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.dashboard', 'Dashboard'),
  };
}

export default Dashboard;
