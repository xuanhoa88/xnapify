/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { getRuntimeVariable } from '../redux';

/**
 * Application routes configuration.
 * Routes are evaluated in order - more specific routes should come first.
 *
 * CODE SPLITTING STRATEGY:
 * Each route uses dynamic import() with webpackChunkName to create separate bundles.
 * The chunk name in the comment (e.g., 'home', 'login') determines the output filename.
 *
 * How it works:
 * 1. Webpack sees import(/* webpackChunkName: 'home' *\/ './home')
 * 2. Creates a separate bundle: home.[hash].js
 * 3. @loadable/component's ChunkExtractor automatically detects required chunks
 * 4. Server injects chunk metadata into HTML for client hydration
 * 5. Client loads chunks on-demand when navigating to routes
 *
 * Benefits:
 * - Smaller initial bundle (only main code loads upfront)
 * - Faster page loads (route code loads on-demand)
 * - Better caching (route chunks cached independently)
 * - Automatic chunk detection (no manual chunks array needed)
 *
 * Note: Dynamic imports must be explicit for webpack to resolve them correctly.
 * Using a helper function with template literals doesn't work with webpack's
 * static analysis.
 */
const routes = {
  children: [
    // Public pages
    {
      action: () => import(/* webpackChunkName: 'home' */ './home'),
    },
    {
      path: '/contact',
      action: () => import(/* webpackChunkName: 'contact' */ './contact'),
    },
    {
      path: '/about',
      action: () => import(/* webpackChunkName: 'about' */ './about'),
    },
    {
      path: '/privacy',
      action: () => import(/* webpackChunkName: 'privacy' */ './privacy'),
    },

    // Authentication pages
    {
      path: '/login',
      action: () => import(/* webpackChunkName: 'login' */ './login'),
    },
    {
      path: '/register',
      action: () => import(/* webpackChunkName: 'register' */ './register'),
    },
    {
      path: '/reset-password',
      action: () =>
        import(/* webpackChunkName: 'reset-password' */ './reset-password'),
    },

    // Protected pages
    {
      path: '/admin',
      action: () => import(/* webpackChunkName: 'admin' */ './admin'),
    },

    // 404 - Must be last
    {
      path: '/*path',
      action: () => import(/* webpackChunkName: 'not-found' */ './not-found'),
    },
  ],

  /**
   * Root action - wraps all child routes.
   * Provides default metadata and executes child route actions.
   */
  async action({ next, store }) {
    const route = await next();

    // Get application metadata from Redux runtime variables (configured via environment variables)
    const state = store.getState();
    const appName = getRuntimeVariable(state, 'appName', 'React Starter Kit');
    const appDescription = getRuntimeVariable(
      state,
      'appDescription',
      'Boilerplate for React.js web applications',
    );

    // Apply default metadata
    return {
      ...route,
      title: (route.title && `${route.title} - ${appName}`) || appName,
      description: route.description || appDescription,
    };
  },
};

/**
 * Development-only routes.
 * Add error page for testing error states.
 */
if (__DEV__) {
  routes.children.unshift({
    path: '/error',
    action: require('./error').default,
  });
}

// Export the routes configuration object as the default export
// This is consumed by the router to set up all application routes
// The structure follows the format expected by the IsomorphicRouter
export default routes;
