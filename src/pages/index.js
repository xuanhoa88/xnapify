/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { getRuntimeVariable } from '../redux';
import IsomorphicNavigator from '../shared/navigator';

/**
 * Automatically discover and load all pages from page folders.
 *
 * This uses webpack's require.context to dynamically import all index.js files
 * from subdirectories. Each page folder should contain an index.js that exports:
 * [route, action] where:
 * - page: Page configuration object (path, priority, devOnly, etc.)
 * - action: Page action function
 *
 * Page modules can export either:
 * 1. A static array: [route, action]
 * 2. A sync function: () => [route, action]
 * 3. An async function: async () => [route, action]
 *
 * Benefits:
 * - No manual page registration needed
 * - Easy to add new pages (just create a folder with index.js)
 * - Pages are automatically sorted by priority
 * - Development-only pages are filtered in production
 * - All page logic is in one file per page
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
 * @typedef {Object} PageRoute
 * @property {string} path - Route path (required)
 * @property {number} [priority] - Route priority (higher = matched first)
 * @property {boolean} [devOnly] - Only load in development mode
 */

/**
 * @typedef {Function} PageAction
 * @param {Object} context - Navigation context
 * @returns {Promise<Object>} Page result
 */

/**
 * Default priority for pages that don't specify a priority value.
 * Pages are sorted by priority (higher priority pages are matched first).
 */
const DEFAULT_PAGE_PRIORITY = 50;

/**
 * Regular expression to extract folder name from webpack require.context path
 * Matches: './folder_name/index.js' and captures 'folder_name'
 */
const PAGE_PATH_REGEX = /^\.\/([^/]+)\//;

/**
 * Build pages array from discovered page modules
 * Supports async page module functions and provides comprehensive error handling
 *
 * @param {__WebpackModuleApi.RequireContext} ctx - Webpack require.context
 * @returns {Promise<Array<Object>>} Sorted array of page objects
 */
async function buildPages(ctx) {
  const pageKeys = ctx.keys();

  if (__DEV__) {
    console.log(`[Navigator] Discovered ${pageKeys.length} page module(s)`);
  }

  const pagePromises = pageKeys.map(async resolvedPath => {
    // Extract folder name from path (e.g., './home/index.js' -> 'home')
    const matchedPath = resolvedPath.match(PAGE_PATH_REGEX);
    if (!matchedPath) {
      console.error(`[Navigator] Invalid page format: ${resolvedPath}`);
      return null;
    }
    const folderName = matchedPath[1];

    try {
      // Load page module
      let factory = ctx(resolvedPath).default;

      // Handle dynamic exports (functions)
      if (typeof factory === 'function') {
        factory = await factory(buildPages);
      }

      // Invalid export format
      if (!Array.isArray(factory)) {
        console.error(
          `[Navigator] Invalid page module in ${folderName}/index.js. Must export an array [route, action] or a function returning [route, action].`,
        );
        return null;
      }

      // Extract route and action from resolved factory
      let [route, action] = factory;

      // Resolve route if it's a function
      if (typeof route === 'function') {
        route = await route(buildPages);
      }

      // Validate route configuration
      if (!route || typeof route !== 'object') {
        console.error(
          `[Navigator] Invalid route configuration in ${folderName}/index.js. Route must be an object.`,
        );
        return null;
      }

      // Validate that route has a path property (empty string '' is valid)
      if (!Object.prototype.hasOwnProperty.call(route, 'path')) {
        console.error(
          `[Navigator] Route in ${folderName}/index.js must have a 'path' property.`,
        );
        return null;
      }

      // Skip development-only routes in production
      if (route.devOnly && !__DEV__) {
        if (__DEV__) {
          console.log(
            `[Navigator] Skipping dev-only route '${route.path}' in ${folderName} (production mode)`,
          );
        }
        return null;
      }

      // Validate and normalize action function
      if (typeof action !== 'function') {
        console.warn(
          `[Navigator] No action function provided for ${folderName}. Using default pass-through action.`,
        );
      }

      // Extract priority before building page
      const priority = Object.prototype.hasOwnProperty.call(route, 'priority')
        ? route.priority
        : DEFAULT_PAGE_PRIORITY;

      // Validate priority is a number
      if (typeof priority !== 'number' || isNaN(priority)) {
        console.warn(
          `[Navigator] Invalid page priority value in ${folderName}. Using default priority ${DEFAULT_PAGE_PRIORITY}.`,
        );
      }

      // Remove custom properties that shouldn't be passed to navigator
      delete route.priority;
      delete route.devOnly;

      // Build complete page object
      const config = {
        ...route,
        action,
        _folderName: folderName, // Add folder name for debugging
      };

      if (__DEV__) {
        console.log(
          `[Navigator] ✓ Page loaded: ${config.path || '(no path)'} (priority: ${priority}, folder: ${folderName})`,
        );
      }

      return { config, priority };
    } catch (error) {
      console.error(
        `[Navigator] Error loading page module ${folderName}/index.js:`,
        error,
      );
      return null;
    }
  });

  // Wait for all page promises to resolve in parallel
  const resolvedPages = await Promise.all(pagePromises);

  // Filter out null values (failed/skipped pages)
  const validPages = resolvedPages.filter(item => item != null);

  // Log summary of failed pages in development
  if (__DEV__) {
    const failedCount = resolvedPages.length - validPages.length;
    if (failedCount > 0) {
      console.warn(
        `[Navigator] ⚠ ${failedCount} page(s) failed to load or were skipped`,
      );
    }
    console.log(`[Navigator] Successfully loaded ${validPages.length} page(s)`);
  }

  // Sort pages by priority (higher priority first)
  validPages.sort((a, b) => {
    const priorityA =
      typeof a.priority === 'number' ? a.priority : DEFAULT_PAGE_PRIORITY;
    const priorityB =
      typeof b.priority === 'number' ? b.priority : DEFAULT_PAGE_PRIORITY;
    return priorityB - priorityA;
  });

  // Extract page objects (without priority metadata)
  return validPages.map(item => item.config);
}

/**
 * Load all page modules using require.context
 * This creates a webpack context that includes all index.js files in subdirectories
 */
const pagesContext = require.context('./', true, /^\.\/[^/]+\/index\.js$/);

/**
 * Create and configure the navigator with async page loading
 *
 * @returns {Promise<IsomorphicNavigator>} Configured navigator instance
 */
export default async function createNavigator() {
  if (__DEV__) {
    console.log('[Navigator] Initializing...');
  }

  // Build pages asynchronously (supports async page modules)
  const children = await buildPages(pagesContext);

  // Create navigator with loaded pages
  const navigator = new IsomorphicNavigator({
    // Disable auto-delegation for root page since we need to post-process child results
    autoDelegate: false,

    // Add action to execute child page and wrap with metadata
    async action(context) {
      // Execute child page
      const page = await context.next();

      // Handle case where no page matches
      if (!page) {
        if (__DEV__) {
          console.warn(
            `[Navigator] No page matched for path: ${context.pathname}`,
          );
        }
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
        ...page,
        title: page.title ? `${page.title} - ${appName}` : appName,
        description: page.description || appDescription,
      };
    },

    // Add pages from page modules
    children,
  });

  if (__DEV__) {
    console.log('[Navigator] ✓ Created successfully');
  }

  return navigator;
}
