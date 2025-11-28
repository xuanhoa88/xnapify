/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import ErrorPage from './ErrorPage';

/**
 * Route configuration
 */
const route = {
  path: '/error',
  devOnly: __DEV__,
};

/**
 * Route action (Development only)
 */
function action() {
  const title = 'Error';

  return {
    title,
    component: (
      <Layout>
        <ErrorPage />
      </Layout>
    ),
  };
}

export default [route, action];
