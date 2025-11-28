/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import Home from './Home';

/**
 * Mock features data - in a real app, this would come from an API
 */
const featuresData = [
  {
    id: 'ssr',
    name: 'Server-Side Rendering',
    description:
      'Fast initial page load with SEO-friendly server-rendered HTML',
    details:
      'Our SSR implementation ensures that your pages are rendered on the server, providing fast initial loads and excellent SEO. The server sends fully rendered HTML to the browser, which is then hydrated with React for interactivity.',
    tags: ['React', 'Performance', 'SEO'],
  },
  {
    id: 'routing',
    name: 'Isomorphic Routing',
    description: 'Universal routing that works on both server and client',
    details:
      'The routing system works seamlessly on both server and client sides, with support for nested routes, dynamic parameters, route guards, and more. It includes automatic code splitting and lazy loading.',
    tags: ['Router', 'SSR', 'CSR'],
  },
  {
    id: 'code-splitting',
    name: 'Code Splitting',
    description: 'Automatic code splitting for optimal bundle sizes',
    details:
      'Webpack automatically splits your code into smaller chunks that are loaded on demand. This reduces the initial bundle size and improves load times significantly.',
    tags: ['Webpack', 'Performance', 'Optimization'],
  },
  {
    id: 'hmr',
    name: 'Hot Module Replacement',
    description: 'Instant updates without page refresh during development',
    details:
      'HMR allows you to update modules in your running application without a full page reload, preserving application state and speeding up development.',
    tags: ['DevEx', 'Webpack', 'Development'],
  },
];

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
            <Layout showHero>
              <Home loading={false} payload={data.news} />
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
              <div
                style={{
                  padding: '2rem',
                  maxWidth: '1200px',
                  margin: '0 auto',
                }}
              >
                <h1>Features</h1>
                <p
                  style={{
                    fontSize: '1.2rem',
                    color: '#666',
                    marginBottom: '2rem',
                  }}
                >
                  Discover the powerful features that make this starter kit
                  amazing.
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '1.5rem',
                  }}
                >
                  {featuresData.map(feature => (
                    <div
                      key={feature.id}
                      style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'pointer',
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>{feature.name}</h3>
                      <p style={{ color: '#666' }}>{feature.description}</p>
                      <div style={{ marginTop: '1rem' }}>
                        {feature.tags.map(tag => (
                          <span
                            key={tag}
                            style={{
                              display: 'inline-block',
                              background: '#f0f0f0',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '12px',
                              fontSize: '0.875rem',
                              marginRight: '0.5rem',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <a
                        href={`/features/${feature.id}`}
                        style={{
                          display: 'inline-block',
                          marginTop: '1rem',
                          color: '#007bff',
                          textDecoration: 'none',
                          fontWeight: 'bold',
                        }}
                      >
                        Learn more →
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </Layout>
          ),
        };
      },
      children: [
        {
          path: '/:featureId',
          async action({ params }) {
            const { featureId } = params;
            const feature = featuresData.find(f => f.id === featureId);

            if (!feature) {
              return {
                title: 'Feature Not Found',
                component: (
                  <Layout>
                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                      <h1>404 - Feature Not Found</h1>
                      <p>The feature &apos;{featureId}&apos; does not exist.</p>
                      <a href='/features' style={{ color: '#007bff' }}>
                        ← Back to Features
                      </a>
                    </div>
                  </Layout>
                ),
              };
            }

            return {
              title: `${feature.name} - Features`,
              description: feature.description,
              component: (
                <Layout>
                  <div
                    style={{
                      padding: '2rem',
                      maxWidth: '800px',
                      margin: '0 auto',
                    }}
                  >
                    <div style={{ marginBottom: '2rem' }}>
                      <a
                        href='/features'
                        style={{ color: '#007bff', textDecoration: 'none' }}
                      >
                        ← Back to all features
                      </a>
                    </div>
                    <h1>{feature.name}</h1>
                    <div style={{ marginBottom: '1.5rem' }}>
                      {feature.tags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            display: 'inline-block',
                            background: '#e3f2fd',
                            color: '#1976d2',
                            padding: '0.5rem 1rem',
                            borderRadius: '16px',
                            fontSize: '0.875rem',
                            marginRight: '0.5rem',
                            fontWeight: 'bold',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p
                      style={{
                        fontSize: '1.25rem',
                        color: '#666',
                        borderLeft: '4px solid #007bff',
                        paddingLeft: '1rem',
                        marginBottom: '2rem',
                      }}
                    >
                      {feature.description}
                    </p>
                    <div
                      style={{
                        background: '#f8f9fa',
                        padding: '1.5rem',
                        borderRadius: '8px',
                        lineHeight: '1.8',
                      }}
                    >
                      <h3>Details</h3>
                      <p>{feature.details}</p>
                    </div>
                  </div>
                </Layout>
              ),
            };
          },
        },
      ],
    },
  ],
};

/**
 * Route action for the home route parent
 * This only delegates to child routes
 */
async function action({ next }) {
  // Delegate to child routes
  return next();
}

export default [route, action];
