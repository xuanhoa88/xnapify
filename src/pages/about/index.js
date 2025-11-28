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
  path: '/about',
};

/**
 * Route action
 * Supports locale-specific content
 */
async function action({ locale }) {
  // Load locale-specific markdown file using static imports to avoid webpack warnings
  let data;

  // Use static imports with switch statement instead of dynamic template literals
  switch (locale) {
    case 'vi-VN':
      try {
        data = await import(/* webpackChunkName: "about" */ './about.vi-VN.md');
      } catch (e) {
        // Fallback to default if locale file doesn't exist
        data = await import(/* webpackChunkName: "about" */ './about.md');
      }
      break;
    default:
      // Default to English or base markdown file
      data = await import(/* webpackChunkName: "about" */ './about.md');
      break;
  }

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
