/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import Contact from './Contact';

/**
 * Route configuration
 */
const route = {
  path: '/contact',
};

/**
 * Route action
 */
function action() {
  const title = 'Contact Us';

  return {
    title,
    component: (
      <Layout>
        <Contact title={title} />
      </Layout>
    ),
  };
}

export default [route, action];
