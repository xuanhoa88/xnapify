/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import Home from './Home';
import Features from './Features';
import FeatureDetails from './FeatureDetails';
import { featuresData } from './data';

const route = {
  path: '',

  children: [
    {
      path: '/',
      async action({ fetch }) {
        // Render the home page
        const title = 'Home';

        // Fetch news data from API
        const { data } = await fetch('/api/news');
        return {
          title,
          component: (
            <Layout>
              <Home
                loading={false}
                payload={data.news}
                featuresData={featuresData}
              />
            </Layout>
          ),
        };
      },
    },
    {
      path: '/features',
      async action() {
        // No need to call next() - children are checked automatically!
        return {
          title: 'Features',
          description: 'Explore our amazing features',
          component: (
            <Layout>
              <Features />
            </Layout>
          ),
        };
      },
      children: [
        {
          path: '/:featureId',
          async action({ params }) {
            const { featureId } = params;
            // We need to check if feature exists to return 404 title if needed
            // although FeatureDetails handles the 404 UI internally.
            // But for the page title, it's better to check here.
            const feature = featuresData.find(f => f.id === featureId);

            if (!feature) {
              return {
                title: 'Feature Not Found',
                component: (
                  <Layout>
                    <FeatureDetails featureId={featureId} />
                  </Layout>
                ),
              };
            }

            return {
              title: `${feature.name} - Features`,
              description: feature.description,
              component: (
                <Layout>
                  <FeatureDetails featureId={featureId} />
                </Layout>
              ),
            };
          },
        },
      ],
    },
  ],
};

export default [route];
