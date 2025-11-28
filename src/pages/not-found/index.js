/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import NotFound from './NotFound';

/**
 * Route configuration
 */
const route = {
  path: '/*path',
  priority: 0,
};

/**
 * Route action (404)
 */
function action() {
  const title = 'Page Not Found';
  return {
    title,
    component: (
      <Layout>
        <NotFound title={title} />
      </Layout>
    ),
    status: 404,
  };
}

export default [route, action];
