/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { getRuntimeVariable, setAdminPanel, setPageHeader } from '../redux';
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
 * Page modules can export either:
 * 1. A static array: [routeConfig, action]
 * 2. A sync function: () => [routeConfig, action]
 * 3. An async function: async () => [routeConfig, action]
 *
 * Benefits:
 * - No manual route registration needed
 * - Easy to add new pages (just create a folder with index.js)
 * - Routes are automatically sorted by priority
 * - Development-only routes are filtered in production
 * - All route logic is in one file per page
 * - Supports both sync and async page module initialization
 *
 * @example
 * // pages/home/index.js - Static export
 * export default [
 *   {
 *     path: '/',
 *     priority: 100,
 *   },
 *   async (context) => {
 *     return {
 *       title: 'Home',
 *       component: <HomePage />,
 *     };
 *   },
 * ];
 *
 * @example
 * // pages/dashboard/index.js - Async initialization
 * export default async () => {
 *   const config = await fetchRouteConfig();
 *   return [
 *     {
 *       path: '/dashboard',
 *       priority: 90,
 *     },
 *     async (context) => {
 *       return {
 *         title: 'Dashboard',
 *         component: <DashboardPage />,
 *       };
 *     },
 *   ];
 * };
 */

/**
 * Default priority for routes that don't specify a priority value.
 * Routes are sorted by priority (higher priority routes are matched first).
 */
const DEFAULT_ROUTE_PRIORITY = 50;

/**
 * Build routes array from discovered page modules
 * Now supports async page module functions
 *
 * @param {__WebpackModuleApi.RequireContext} pagesContext - Webpack require.context
 * @returns {Promise<Array<object>>} Sorted array of route objects
 */
async function buildRoutes(pagesContext) {
  const routePromises = pagesContext.keys().map(async pagePath => {
    // Extract folder name from path (e.g., './home/index.js' -> 'home')
    const match = pagePath.match(/^\.\/([^/]+)\//);
    if (!match) {
      console.error(`[Routes] Invalid page path format: ${pagePath}`);
      return null;
    }
    const folderName = match[1];

    try {
      // Load page module
      const pageModule = pagesContext(pagePath).default;

      // Initialize route config and action
      let routeConfig, routeAction;

      // Handle dynamic exports (functions)
      if (typeof pageModule === 'function') {
        // Call function and await result (works for both sync and async)
        const result = await pageModule();
        [routeConfig, routeAction] = result;
      }
      // Handle static exports
      else if (Array.isArray(pageModule)) {
        [routeConfig, routeAction] = pageModule;
      }
      // Handle default exports
      else {
        console.error(
          `[Routes] Invalid page module in ${folderName}/index.js. Must be an array or function.`,
        );
        return null;
      }

      // Validate route configuration
      if (!routeConfig || typeof routeConfig !== 'object') {
        console.error(
          `[Routes] Invalid route configuration in ${folderName}/index.js. Route must be an object.`,
        );
        return null;
      }

      // Validate action function
      // If action is not a function, set it to a default action that calls next()
      if (typeof routeAction !== 'function') {
        console.warn(
          `[Routes] No action function provided for ${folderName}. Using default pass-through action.`,
        );
      }

      // Skip development-only routes in production
      if (routeConfig.devOnly && !__DEV__) {
        console.log(
          `[Routes] Skipping dev-only route in ${folderName} (production mode)`,
        );
        return null;
      }

      // Validate that route has a path property (empty string '' is valid)
      if (!Object.prototype.hasOwnProperty.call(routeConfig, 'path')) {
        console.error(
          `[Routes] Route in ${folderName}/index.js must have a 'path' property.`,
        );
        return null;
      }

      // Extract priority before building route
      const priority = Object.prototype.hasOwnProperty.call(
        routeConfig,
        'priority',
      )
        ? routeConfig.priority
        : DEFAULT_ROUTE_PRIORITY;

      // Build complete route object
      const route = {
        ...routeConfig,
        action: routeAction,
        _folderName: folderName, // Add folder name for debugging
      };

      // Remove custom properties that shouldn't be passed to router
      delete route.priority;
      delete route.devOnly;

      if (__DEV__) {
        console.log(
          `[Routes] Loaded route: ${routeConfig.path} (priority: ${priority}, folder: ${folderName})`,
        );
      }

      return { route, priority };
    } catch (error) {
      console.error(
        `[Routes] Error loading page module ${folderName}/index.js:`,
        error,
      );
      return null;
    }
  });

  // Wait for all route promises to resolve in parallel
  const resolvedRoutes = await Promise.all(routePromises);

  // Filter out null values (failed/skipped routes)
  const validRoutes = resolvedRoutes.filter(item => item !== null);

  // Sort routes by priority (higher priority first)
  validRoutes.sort((a, b) => b.priority - a.priority);

  // Extract route objects (without priority metadata)
  return validRoutes.map(item => item.route);
}

/**
 * Load all page modules using require.context
 * This creates a webpack context that includes all index.js files in subdirectories
 */
const pagesContext = require.context('./', true, /^\.\/[^/]+\/index\.js$/);

/**
 * Create and configure the router with async route loading
 *
 * @returns {Promise<IsomorphicRouter>} Configured router instance
 */
export default async function createRouter() {
  // Build routes asynchronously (supports async page modules)
  const routes = await buildRoutes(pagesContext);

  // Create router with loaded routes
  const router = new IsomorphicRouter(
    {
      // Disable auto-delegation for root route since we need to post-process child results
      autoDelegate: false,

      // Add action to execute child route and wrap with metadata
      async action(context) {
        // Reset UI state for non-admin, non-home routes
        context.store.dispatch(setAdminPanel(false));
        context.store.dispatch(setPageHeader(false));

        // Execute child route
        const route = await context.next();

        // Handle case where no route matches
        if (!route) {
          return null;
        }

        // Get application metadata from Redux runtime variables
        const state = context.store.getState();
        const appName = getRuntimeVariable(
          state,
          'appName',
          'React Starter Kit',
        );
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
      children: routes,
    },
    {
      // Pass utilities through context so they're available to all route actions
      context: {
        buildRoutes,
      },
    },
  );

  if (__DEV__) {
    console.log('[Routes] Router created successfully');
    router.printRoutes();
  }

  return router;
}
