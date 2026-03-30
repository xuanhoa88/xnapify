/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Features from '../components/Features';

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('navigation.features', 'Features'),
    description: 'Explore our amazing features',
  };
}

/**
 * Default export - Page component
 */
export default Features;
