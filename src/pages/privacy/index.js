/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import Page from '../../components/Page';

/**
 * Route configuration
 */
const route = {
  path: '/privacy',
};

/**
 * Route action
 */
async function action() {
  // Load markdown file (only English version exists)
  const data = await import(/* webpackChunkName: "privacy" */ './privacy.md');

  return {
    title: data.attributes.title,
    component: (
      <Layout>
        <Page title={data.attributes.title} html={data.html} />
      </Layout>
    ),
  };
}

export default [route, action];
