/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import Home from './Home';

/**
 * Home route
 */
async function action({ fetch }) {
  const title = 'Home';

  // Fetch news data from API
  const data = await fetch('/api/news');

  return {
    title,
    component: (
      <Layout showHero>
        {'AAAA'}
        <Home loading={false} payload={data.payload} />
      </Layout>
    ),
  };
}

export default action;
