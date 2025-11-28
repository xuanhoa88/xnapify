/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { getRuntimeVariable } from '../redux';
import IsomorphicRouter from '../router';

/**
 * Automatically discover and load all routes from page folders.
 *
 * This uses webpack's require.context to dynamically import all index.js files
 * from subdirectories. Each page folder should contain an index.js that exports:
 * [route, action] where:
 * - route: Route configuration object (path, priority, devOnly, etc.)
 * - action: Route action function
 *
 * Benefits:
 * - No manual route registration needed
 * - Easy to add new pages (just create a folder with index.js)
 * - Routes are automatically sorted by priority
 * - Development-only routes are filtered in production
 * - All route logic is in one file per page
 *
 * @example
 * // pages/home/index.js
 * export default [
 *   // Route configuration
 *   {
 *     path: '/',
 *     priority: 100,      // Optional, defaults to 50. Higher = matched first
 *     devOnly: false,     // Optional, if true, only included in development
 *   },
 *   // Route action
 *   async (context) => {
 *     const { store, pathname, params } = context;
 *     return {
 *       title: 'Home',
 *       description: 'Welcome to our site',
 *       component: <HomePage />,
 *     };
 *   },
 * ];
 *
 * @example
 * // pages/user/index.js - Nested routes example
 * export default [
 *   {
 *     path: '/users',
 *     priority: 80,
 *     children: [
 *       {
 *         path: '/:id',
 *         action: async (context) => {
 *           const { params, store } = context;
 *           return {
 *             title: `User ${params.id}`,
 *             component: <UserProfile userId={params.id} />,
 *           };
 *         },
 *       },
 *     ],
 *   },
 *   async (context) => {
 *     // Parent route action
 *     return context.next(); // Continue to children
 *   },
 * ];
 */

/**
 * Default priority for routes that don't specify a priority value.
 * Routes are sorted by priority (higher priority routes are matched first).
 */
const DEFAULT_ROUTE_PRIORITY = 50;

/**
 * Load all page modules using require.context
 * This creates a webpack context that includes all index.js files in subdirectories
 */
const pagesContext = require.context('./', true, /^\.\/[^/]+\/index\.js$/);

/**
 * Build routes array from discovered page modules
 */
function buildRoutes() {
  const routes = [];

  // Iterate through all discovered index.js files
  pagesContext.keys().forEach(pagePath => {
    // Extract folder name from path (e.g., './home/index.js' -> 'home')
    const match = pagePath.match(/^\.\/([^/]+)\//);
    if (!match) {
      console.error(`[Routes] Invalid page path format: ${pagePath}`);
      return;
    }
    const folderName = match[1];

    try {
      // Load page module [route, action]
      const pageModule = pagesContext(pagePath).default;

      // Validate module format
      if (!Array.isArray(pageModule) || pageModule.length !== 2) {
        console.error(
          `[Routes] Invalid page module format in ${folderName}/index.js. Expected [route, action].`,
        );
        return;
      }

      const [routeConfig, routeAction] = pageModule;

      // Validate route configuration
      if (!routeConfig || typeof routeConfig !== 'object') {
        console.error(
          `[Routes] Invalid route configuration in ${folderName}/index.js. Route must be an object.`,
        );
        return;
      }

      // Validate action function
      if (typeof routeAction !== 'function') {
        console.error(
          `[Routes] Invalid route action in ${folderName}/index.js. Action must be a function.`,
        );
        return;
      }

      // Skip development-only routes in production
      if (routeConfig.devOnly) {
        console.log(
          `[Routes] Skipping dev-only route in ${folderName} (production mode)`,
        );
        return;
      }

      // Validate that route has a path property (empty string '' is valid)
      if (!Object.prototype.hasOwnProperty.call(routeConfig, 'path')) {
        console.error(
          `[Routes] Route in ${folderName}/index.js must have a 'path' property.`,
        );
        return;
      }

      // Build complete route object
      const route = {
        ...routeConfig,
        action: routeAction,
        _folderName: folderName, // Add folder name for debugging
      };

      // Remove custom properties that shouldn't be passed to router
      delete route.priority;
      delete route.devOnly;

      routes.push({
        route,
        priority: Object.hasOwnProperty.call(routeConfig, 'priority')
          ? routeConfig.priority
          : DEFAULT_ROUTE_PRIORITY,
      });

      if (__DEV__) {
        console.log(
          `[Routes] Loaded route: ${routeConfig.path} (priority: ${routeConfig.priority || DEFAULT_ROUTE_PRIORITY})`,
        );
      }
    } catch (error) {
      console.error(
        `[Routes] Error loading page module ${folderName}/index.js:`,
        error,
      );
    }
  });

  // Sort routes by priority (higher priority first)
  routes.sort((a, b) => b.priority - a.priority);

  // Extract route objects (without priority metadata)
  const sortedRoutes = routes.map(item => item.route);

  if (__DEV__) {
    console.log(`[Routes] Total routes loaded: ${sortedRoutes.length}`);
  }

  return sortedRoutes;
}

// Create router
const router = new IsomorphicRouter({
  // Disable auto-delegation for root route since we need to post-process child results
  autoDelegate: false,

  // Add action to execute child route and wrap with metadata
  async action(context) {
    // Execute child route
    const route = await context.next();

    // Handle case where no route matches
    if (!route) {
      return null;
    }

    // Get application metadata from Redux runtime variables
    const state = context.store.getState();
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

  // Add routes from page modules
  children: buildRoutes(),
});

// Export router
export default router;
