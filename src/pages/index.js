/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { getAppName, getAppDescription } from '../shared/renderer/redux';
import IsomorphicNavigator from '../shared/renderer/Navigator';

/**
 * Checks if value is a plain object (created by Object constructor or Object.create(null))
 * @param {*} value - The value to check
 * @returns {boolean} Returns true if value is a plain object, else false
 */
function isPlainObject(value) {
  // Early return for null, undefined, primitives
  if (value == null || typeof value !== 'object') {
    return false;
  }

  // Get the internal [[Class]]
  const tag = Object.prototype.toString.call(value);

  // Must be [object Object]
  if (tag !== '[object Object]') {
    return false;
  }

  // Objects created via Object.create(null) have no prototype - these are plain
  const proto = Object.getPrototypeOf(value);
  if (proto === null) {
    return true;
  }

  // Get the constructor from the prototype
  const Ctor =
    Object.prototype.hasOwnProperty.call(proto, 'constructor') &&
    proto.constructor;

  // Check if constructor is the Object constructor
  return (
    typeof Ctor === 'function' &&
    Ctor instanceof Ctor &&
    Function.prototype.toString.call(Ctor) ===
      Function.prototype.toString.call(Object)
  );
}

/**
 * Automatically discover and load all pages from page folders.
 *
 * This uses webpack's require.context to dynamically import all index.js files
 * from subdirectories. Each page folder should contain an index.js that exports
 * a route configuration object with the following properties:
 * - path: Route path (required)
 * - action: Page action function (optional)
 * - children: Child routes (optional)
 * - priority: Route priority (optional, default: 50)
 * - devOnly: Only load in development mode (optional)
 * - boot: One-time initialization function (optional)
 * - mount: Called on every route match to return metadata (optional)
 *
 * Page modules can export either:
 * 1. A static object: { path, action?, children?, ... }
 * 2. A sync function: () => { path, action?, children?, ... }
 * 3. An async function: async (pageBuilder) => { path, action?, children?, ... }
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
 * // pages/login/index.js - Simple route with inline action
 * export default {
 *   path: '/login',
 *   action(context, { metadata }) {
 *     return {
 *       title: 'Log In',
 *       component: <LoginPage />,
 *     };
 *   },
 * };
 *
 * @example
 * // pages/admin/index.js - Async initialization with child routes and lifecycle hooks
 * export default async (pageBuilder) => {
 *   const children = await pageBuilder(pagesContext);
 *   return {
 *     path: '/admin',
 *     children,
 *     boot({ store }) {
 *       store.injectReducer('admin', reducer);
 *     },
 *     mount() {
 *       return { breadcrumb: { label: 'Admin' } };
 *     },
 *     async action(context, { metadata }) {
 *       const childPage = await context.next();
 *       return {
 *         title: 'Admin Panel',
 *         component: <AdminLayout>{childPage.component}</AdminLayout>,
 *       };
 *     },
 *   };
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
 * @param {Object} options - Options object
 * @param {Array} options.metadata - Accumulated metadata from matched views
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
async function createPages(ctx) {
  const modulePaths = ctx.keys();

  if (__DEV__) {
    console.log(`[Navigator] Discovered ${modulePaths.length} page module(s)`);
  }

  const pages = modulePaths.map(async resolvedPath => {
    // Extract folder name from path (e.g., './home/index.js' -> 'home')
    const pathMatch = resolvedPath.match(PAGE_PATH_REGEX);
    if (!pathMatch) {
      console.error(`[Navigator] Invalid page format: ${resolvedPath}`);
      return null;
    }
    const folderName = pathMatch[1];

    try {
      // Load page module
      let pageModule = ctx(resolvedPath).default;

      // Handle dynamic exports (functions that return route config)
      if (typeof pageModule === 'function') {
        pageModule = await pageModule(createPages);
      }

      // Validate export format - must be a plain object
      if (!isPlainObject(pageModule)) {
        console.error(
          `[Navigator] Invalid page module in ${folderName}/index.js. Must export an object { path, action?, children?, ... } or a function returning one.`,
        );
        return null;
      }

      // Extract route config and action from resolved module
      const { action, ...routeConfig } = pageModule;

      // Validate that route has a path property (empty string '' is valid)
      if (!Object.prototype.hasOwnProperty.call(routeConfig, 'path')) {
        console.error(
          `[Navigator] Route in ${folderName}/index.js must have a 'path' property.`,
        );
        return null;
      }

      // Skip development-only routes in production
      if (routeConfig.devOnly && !__DEV__) {
        if (__DEV__) {
          console.log(
            `[Navigator] Skipping dev-only route '${routeConfig.path}' in ${folderName} (production mode)`,
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

      // Extract priority before building page config
      const priority = Object.prototype.hasOwnProperty.call(
        routeConfig,
        'priority',
      )
        ? routeConfig.priority
        : DEFAULT_PAGE_PRIORITY;

      // Validate priority is a number
      if (typeof priority !== 'number' || isNaN(priority)) {
        console.warn(
          `[Navigator] Invalid page priority value in ${folderName}. Using default priority ${DEFAULT_PAGE_PRIORITY}.`,
        );
      }

      // Remove custom properties that shouldn't be passed to navigator
      delete routeConfig.priority;
      delete routeConfig.devOnly;

      // Build complete page config
      const pageConfig = {
        ...routeConfig,
        action,
        _folderName: folderName, // Add folder name for debugging
      };

      if (__DEV__) {
        console.log(
          `[Navigator] ✓ Page loaded: ${pageConfig.path || '(no path)'} (priority: ${priority}, folder: ${folderName})`,
        );
      }

      return { pageConfig, priority };
    } catch (error) {
      console.error(
        `[Navigator] Error loading page module ${folderName}/index.js:`,
        error,
      );
      return null;
    }
  });

  // Wait for all page promises to resolve in parallel
  const pageResults = await Promise.all(pages);

  // Filter out null values (failed/skipped pages)
  const loadedPages = pageResults.filter(item => item != null);

  // Log summary of failed pages in development
  if (__DEV__) {
    const failedCount = pageResults.length - loadedPages.length;
    if (failedCount > 0) {
      console.warn(
        `[Navigator] ⚠ ${failedCount} page(s) failed to load or were skipped`,
      );
    }
    console.log(
      `[Navigator] Successfully loaded ${loadedPages.length} page(s)`,
    );
  }

  // Sort pages by priority (higher priority first)
  loadedPages.sort((a, b) => {
    const priorityA =
      typeof a.priority === 'number' ? a.priority : DEFAULT_PAGE_PRIORITY;
    const priorityB =
      typeof b.priority === 'number' ? b.priority : DEFAULT_PAGE_PRIORITY;
    return priorityB - priorityA;
  });

  // Extract page configs (without priority metadata)
  return loadedPages.map(item => item.pageConfig);
}

// Auto-load pages via require.context
const pagesContext = require.context(
  './',
  true,
  /^\.\/[^/]+\/index\.(jsx?|tsx?)$/,
);

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
  const pages = await createPages(pagesContext);

  // Create navigator with loaded pages
  const navigator = new IsomorphicNavigator({
    // Disable auto-delegation for root page since we need to post-process child results
    autoResolve: false,

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
      const appName = getAppName(state);
      const appDescription = getAppDescription(state);

      // Apply default metadata
      return {
        ...page,
        title: page.title ? `${page.title} - ${appName}` : appName,
        description: page.description || appDescription,
      };
    },

    // Add pages from page modules
    children: pages,
  });

  if (__DEV__) {
    console.log('[Navigator] ✓ Created successfully');
  }

  return navigator;
}
