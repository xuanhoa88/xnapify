/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { getAppName, getAppDescription } from '../shared/renderer/redux';
import IsomorphicNavigator from '../shared/renderer/Navigator';

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
 * Development-only logger helper
 * @param {string} message - Log message
 * @param {'log'|'warn'|'error'} [level='log'] - Log level
 */
function logDev(message, level = 'log') {
  if (__DEV__) {
    console[level](`[Navigator] ${message}`);
  }
}

/**
 * Extract folder name from webpack require.context path
 * @param {string} resolvedPath - Path like './home/index.js'
 * @returns {string|null} Folder name or null if invalid
 */
function extractFolderName(resolvedPath) {
  const match = resolvedPath.match(PAGE_PATH_REGEX);
  return match ? match[1] : null;
}

/**
 * Resolve page module (handles both static objects and async functions)
 * @param {Object|Function} module - Page module export
 * @param {Function} pageBuilder - Builder function for nested pages
 * @returns {Promise<Object>} Resolved page configuration
 */
async function resolvePageModule(module, pageBuilder) {
  return typeof module === 'function' ? module(pageBuilder) : module;
}

/**
 * Validate page module structure
 * @param {*} module - Module to validate
 * @param {string} folderName - Folder name for error messages
 * @returns {{valid: boolean, error?: string}} Validation result
 */
function validatePageModule(module, folderName) {
  if (!isPlainObject(module)) {
    return {
      valid: false,
      error: `Invalid page module in ${folderName}/index.js. Must export an object or function returning one.`,
    };
  }

  if (!('path' in module)) {
    return {
      valid: false,
      error: `Route in ${folderName}/index.js must have a 'path' property.`,
    };
  }

  return { valid: true };
}

/**
 * Normalize priority value with fallback to default
 * @param {*} value - Priority value to normalize
 * @param {string} folderName - Folder name for warning messages
 * @returns {number} Valid priority number
 */
function normalizePriority(value, folderName) {
  if (value == null) {
    return DEFAULT_PAGE_PRIORITY;
  }

  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  logDev(
    `Invalid priority value in ${folderName}. Using default ${DEFAULT_PAGE_PRIORITY}.`,
    'warn',
  );
  return DEFAULT_PAGE_PRIORITY;
}

/**
 * Load and process a single page module
 * @param {__WebpackModuleApi.RequireContext} ctx - Webpack require.context
 * @param {string} resolvedPath - Module path
 * @returns {Promise<{pageConfig: Object, priority: number}|null>} Page result or null
 */
async function loadPageModule(ctx, resolvedPath) {
  const folderName = extractFolderName(resolvedPath);
  if (!folderName) {
    logDev(`Invalid page format: ${resolvedPath}`, 'error');
    return null;
  }

  try {
    // Load and resolve module
    const rawModule = ctx(resolvedPath).default;
    const pageModule = await resolvePageModule(rawModule, createPages);

    // Validate structure
    const validation = validatePageModule(pageModule, folderName);
    if (!validation.valid) {
      logDev(validation.error, 'error');
      return null;
    }

    // Skip dev-only routes in production
    if (pageModule.devOnly && !__DEV__) {
      return null;
    }

    // Extract and normalize priority
    const priority = normalizePriority(pageModule.priority, folderName);

    // Warn if no action provided
    if (typeof pageModule.action !== 'function') {
      logDev(`No action function provided for ${folderName}.`, 'warn');
    }

    // Build clean page config (exclude internal properties)
    const { priority: _, devOnly: __, ...routeConfig } = pageModule;
    const pageConfig = {
      ...routeConfig,
      _folderName: folderName,
    };

    logDev(
      `✓ Page loaded: ${pageConfig.path || '(no path)'} (priority: ${priority}, folder: ${folderName})`,
    );

    return { pageConfig, priority };
  } catch (error) {
    console.error(
      `[Navigator] Error loading page module ${folderName}/index.js:`,
      error,
    );
    return null;
  }
}

/**
 * Build pages array from discovered page modules
 * @param {__WebpackModuleApi.RequireContext} ctx - Webpack require.context
 * @returns {Promise<Array<Object>>} Sorted array of page objects
 */
async function createPages(ctx) {
  const modulePaths = ctx.keys();
  logDev(`Discovered ${modulePaths.length} page module(s)`);

  // Load all pages in parallel with error isolation
  const results = await Promise.allSettled(
    modulePaths.map(path => loadPageModule(ctx, path)),
  );

  // Filter successful loads and sort by priority (descending)
  const loadedPages = results
    .filter(r => r.status === 'fulfilled' && r.value != null)
    .map(r => r.value)
    .sort((a, b) => b.priority - a.priority);

  // Log summary
  const failedCount = results.length - loadedPages.length;
  if (failedCount > 0) {
    logDev(`⚠ ${failedCount} page(s) failed to load or were skipped`, 'warn');
  }
  logDev(`Successfully loaded ${loadedPages.length} page(s)`);

  return loadedPages.map(item => item.pageConfig);
}

// Auto-load pages via require.context
const pagesContext = require.context(
  './',
  true,
  /^\.\/[^/]+\/index\.[cm]?[jt]sx?$/i,
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
