/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import TestNextJSPage from './TestNextJS';

export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('navigation.testNextJS', 'Test NextJS'),
    description: 'Testing the new Next.js-Style file-based routing system',
  };
}

export default TestNextJSPage;
