/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { match } from 'path-to-regexp';

/**
 * HTTP status codes used in routing
 * @constant {Object}
 */
const HTTP_STATUS = Object.freeze({
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
});

/**
 * Route matching constants
 * @constant {Object}
 */
const ROUTE_CONSTANTS = Object.freeze({
  EMPTY_PATH: '',
  TRAILING_SLASH: '/',
  LAST_CHAR_INDEX: -1,
});

/**
 * Safely decode a URI component.
 * Returns the original value if decoding fails.
 *
 * @param {string} val - The value to decode
 * @returns {string} The decoded value or original value if decoding fails
 */
function decode(val) {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

/**
 * Check if a value is a valid route object.
 *
 * @param {*} value - The value to check
 * @returns {boolean} True if the value is a valid route object
 */
function isValidRoute(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if a pathname is valid.
 *
 * @param {*} pathname - The pathname to validate
 * @returns {boolean} True if the pathname is a non-empty string
 */
function isValidPathname(pathname) {
  return typeof pathname === 'string' && pathname.length > 0;
}

/**
 * Normalize a pathname by removing duplicate slashes and ensuring proper format.
 *
 * @param {string} path - The path to normalize
 * @returns {string} The normalized path
 */
function normalizePath(path) {
  if (typeof path !== 'string') {
    return '/';
  }

  // Ensure leading slash, remove duplicate slashes
  let normalized = ('/' + path).replace(/\/+/g, '/');
  // Remove trailing slash unless it's the root path
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Build a query string from an object.
 * Handles arrays, nested objects, and special values.
 *
 * @param {Object} query - Query parameters object
 * @returns {string} The encoded query string (without leading '?')
 */
function buildQueryString(query) {
  if (!query || typeof query !== 'object' || Object.keys(query).length === 0) {
    return null;
  }

  const parts = [];

  const addParam = (key, value) => {
    if (value != null) {
      parts.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
      );
    }
  };

  Object.keys(query).forEach(key => {
    const value = query[key];

    // Skip null and undefined values
    if (value == null) {
      return;
    }

    // Handle arrays (repeat key for each value)
    if (Array.isArray(value)) {
      value.forEach(item => addParam(key, item));
    }
    // Handle nested objects (use bracket notation)
    else if (typeof value === 'object' && value !== null) {
      Object.keys(value).forEach(nestedKey => {
        addParam(`${key}[${nestedKey}]`, value[nestedKey]);
      });
    }
    // Handle primitive values
    else {
      addParam(key, value);
    }
  });

  return parts.join('&');
}

/**
 * Validate route configuration recursively.
 *
 * @param {Object|Array} routes - Routes to validate
 * @param {string} [trace=''] - Trace for context
 * @throws {TypeError} If route configuration is invalid
 */
function validateRoutes(routeConfig, trace = '') {
  const normalizedRoutes = Array.isArray(routeConfig)
    ? routeConfig
    : [routeConfig];

  normalizedRoutes.forEach((route, index) => {
    const location = `${trace}[${index}]`;

    if (!isValidRoute(route)) {
      throw new TypeError(
        `Invalid route at ${location}: route must be an object`,
      );
    }

    if (route.path != null && typeof route.path !== 'string') {
      throw new TypeError(`${location}.path: must be a string`);
    }

    if (route.action != null && typeof route.action !== 'function') {
      throw new TypeError(`${location}.action: must be a function`);
    }

    if (route.children) {
      validateRoutes(route.children, `${location}.children`);
    }
  });
}

/**
 * Get the route tree as a structured object.
 *
 * @param {Object} root - The root route object
 * @returns {Object} The route tree structure
 */
function getRouteTree(root) {
  const buildTree = route => {
    const node = {
      path: route.path || '(root)',
      hasAction: typeof route.action === 'function',
      autoDelegate: route.autoDelegate !== false,
    };

    if (Array.isArray(route.children) && route.children.length > 0) {
      node.children = route.children.map(buildTree);
    }

    return node;
  };

  return buildTree(root);
}

/**
 * Create a standardized error object.
 *
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {Object} [details={}] - Additional error details
 * @returns {Error} Error object with status and details
 */
function createRouterError(message, status, details = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, details);
  return error;
}

/**
 * Recursively set parent references for all routes in the tree.
 * This ensures the parent chain is properly maintained for nested routes.
 *
 * @param {Object} route - The route to process
 * @param {Object|null} parent - The parent route
 */
function setParentReferences(route, parent = null) {
  route.parent = parent;
  if (route.children) {
    route.children.forEach(child => setParentReferences(child, route));
  }
}

/**
 * Calculate the child pathname based on parent's consumed path.
 * This handles the complex logic of determining what portion of the pathname
 * should be passed to child routes.
 *
 * Key behaviors:
 * - Empty path ('') consumes nothing → pass full pathname to children
 * - Root path ('/') consumes the leading slash → pass remainder to children
 * - Other paths consume their matched portion → pass remainder to children
 *
 * @param {string} pathname - The original pathname being matched
 * @param {string} consumedPath - The path pattern of the parent route
 * @param {string} matchedPath - The actual matched path from the parent
 * @returns {string} The pathname to pass to child routes
 */
function calculateChildPathname(pathname, consumedPath, matchedPath) {
  // Empty path consumes nothing, pass full remaining pathname to children
  // This is the key behavior that allows parent routes with path: '' to delegate
  // to children without consuming any portion of the URL
  if (consumedPath === '') {
    return pathname;
  }

  // Slice off the matched portion for non-empty paths
  let childPathname = pathname.slice(matchedPath.length);

  // Ensure child pathname starts with / for proper matching
  if (childPathname && !childPathname.startsWith('/')) {
    childPathname = '/' + childPathname;
  }

  // Handle empty child pathname for index routes
  if (!childPathname) {
    childPathname = '/';
  }

  return childPathname;
}

/**
 * Creates an iterator that matches routes against a pathname.
 * Supports nested routes and route skipping.
 *
 * @param {Object} route - The route to match
 * @param {string} baseUrl - The base URL for the route
 * @param {Object} options - Matching options
 * @param {string} pathname - The pathname to match against
 * @param {Object} [parentParams={}] - Parameters from parent routes
 * @returns {Object} An iterator with a next() method
 */
function matchRoute(route, baseUrl, options, pathname, parentParams = {}) {
  let matchResult;
  let childMatches = null;
  let childIndex = 0;

  // Normalize the base URL
  const normalizedBaseUrl = normalizePath(baseUrl);

  return {
    next(routeToSkip) {
      // Skip this route if it matches the route to skip
      if (route === routeToSkip) {
        return { done: true, value: false };
      }

      // Try to match the current route
      if (!matchResult) {
        const end = !route.children;

        // Cache the match function on the route object for performance
        if (!route.match) {
          route.match = match(route.path || '', { end, ...options });
        }

        // Match the current route
        matchResult = route.match(pathname);
        if (matchResult) {
          // Retrieve the path from the match result
          let { path } = matchResult;

          // Remove trailing slash for non-end routes
          const hasTrailingSlash =
            path.charAt(path.length + ROUTE_CONSTANTS.LAST_CHAR_INDEX) ===
            ROUTE_CONSTANTS.TRAILING_SLASH;
          if (!end && hasTrailingSlash) {
            path = path.slice(0, -1);
          }
          matchResult.path = path;

          // Merge parent and current route parameters
          matchResult.params = { ...parentParams, ...matchResult.params };

          return {
            done: false,
            value: {
              route,
              baseUrl: normalizedBaseUrl,
              path: matchResult.path,
              params: matchResult.params,
            },
          };
        }
      }

      // Try to match child routes
      if (matchResult && route.children) {
        while (childIndex < route.children.length) {
          // If child matches are not found, try to match the child routes
          if (!childMatches) {
            // Get the child route
            const childRoute = route.children[childIndex];
            childRoute.parent = route;

            // Calculate the pathname to pass to child routes
            // This uses the helper function to handle empty paths, root paths, and regular paths
            const childPathname = calculateChildPathname(
              pathname,
              route.path || '',
              matchResult.path,
            );

            // Match child route
            childMatches = matchRoute(
              childRoute,
              normalizedBaseUrl + matchResult.path,
              options,
              childPathname,
              matchResult.params,
            );
          }

          // Get next match
          const childMatch = childMatches.next(routeToSkip);
          if (!childMatch.done) {
            return { done: false, value: childMatch.value };
          }

          // Reset child matches and move to next child
          childMatches = null;
          childIndex++;
        }
      }

      return { done: true, value: false };
    },
  };
}

/**
 * Default route resolver function.
 * Handles both synchronous (require) and asynchronous (import) route actions.
 *
 * Supports two patterns:
 * 1. Direct action function: action: (context) => ({ component: ... })
 * 2. Module import: action: () => import('./route') or require('./route')
 *
 * @param {Object} context - The route context
 * @param {Object} params - Route parameters
 * @returns {Promise<*>} The result of the route action or undefined
 */
async function resolveRoute(context, params) {
  // If route has an action, execute it
  if (typeof context.route.action !== 'function') {
    return undefined;
  }

  // Check if route has children and auto-delegation is enabled
  const hasChildren =
    Array.isArray(context.route.children) && context.route.children.length > 0;
  const autoDelegate = context.route.autoDelegate !== false; // Default true

  // If route has children and auto-delegation is enabled, check children first
  if (hasChildren && autoDelegate) {
    const childResult = await context.next();
    if (childResult != null) {
      return childResult;
    }
  }

  // Execute the action function
  const result = await context.route.action(context, params);

  // If result is a module (from require or import), extract default export
  if (result && typeof result === 'object' && 'default' in result) {
    // Check if default export is a function (action function)
    if (typeof result.default === 'function') {
      // Call the action function with context
      return result.default(context, params);
    }
    // If default is not a function, return it as-is
    return result.default;
  }

  // Return result directly (already a route result object)
  return result;
}

/**
 * Check if a route is a child of another route.
 *
 * @param {Object} parentRoute - The potential parent route
 * @param {Object} childRoute - The potential child route
 * @returns {boolean} True if childRoute is a descendant of parentRoute
 */
function isChildRoute(parentRoute, childRoute) {
  let route = childRoute;
  while (route) {
    route = route.parent;
    if (route === parentRoute) {
      return true;
    }
  }
  return false;
}

/**
 * IsomorphicRouter - A client/server hybrid router for isomorphic JavaScript web apps.
 * Works seamlessly on both client-side and server-side rendering (SSR).
 *
 * Features:
 * - Nested routes with parameter inheritance
 * - Dynamic route management (add/remove/update at runtime)
 * - Route caching for performance
 * - Custom error handling
 * - Base URL support
 * - Index route support
 * - O(1) route lookups via internal indexing
 */
export default class IsomorphicRouter {
  /**
   * Create a new IsomorphicRouter instance.
   *
   * @param {Object|Array} routes - Route configuration (single route or array of routes)
   * @param {Object} [options={}] - Router options
   * @param {string} [options.baseUrl=''] - Base URL for all routes
   * @param {Function} [options.decode] - Custom URL decode function
   * @param {Function} [options.resolveRoute] - Custom route resolver function
   * @param {Function} [options.errorHandler] - Custom error handler function
   * @param {Object} [options.context] - Additional context to pass to route actions
   * @throws {TypeError} If routes is not an object or array
   */
  constructor(routes, options = {}) {
    // Validate route configuration
    validateRoutes(routes);

    // Initialize router options
    this.options = { decode, ...options };
    this.baseUrl = this.options.baseUrl || ROUTE_CONSTANTS.EMPTY_PATH;

    // Create root node
    this.root = Array.isArray(routes)
      ? {
          path: ROUTE_CONSTANTS.EMPTY_PATH,
          children: routes,
          parent: null,
        }
      : routes;

    // Set parent references for all routes
    setParentReferences(this.root, null);

    // Initialize route index for O(1) lookups
    // eslint-disable-next-line no-underscore-dangle
    this._routeIndex = new Map();
    // eslint-disable-next-line no-underscore-dangle
    this._indexRoutes(this.root);
  }

  /**
   * Index routes recursively for fast O(1) lookups.
   *
   * @param {Object} route - The route to index
   * @private
   */
  _indexRoutes(route) {
    if (route.path) {
      // eslint-disable-next-line no-underscore-dangle
      this._routeIndex.set(route.path, route);
    }
    if (Array.isArray(route.children)) {
      // eslint-disable-next-line no-underscore-dangle
      route.children.forEach(child => this._indexRoutes(child));
    }
  }

  /**
   * Rebuild the route index for a specific subtree.
   * More efficient than rebuilding the entire index.
   *
   * @param {Object} [subtree] - The subtree to rebuild, or entire tree if not specified
   * @private
   */
  _rebuildIndex(subtree) {
    if (subtree) {
      // Only rebuild the specified subtree
      // First, remove old entries for this subtree
      const removeFromIndex = route => {
        if (route.path) {
          // eslint-disable-next-line no-underscore-dangle
          this._routeIndex.delete(route.path);
        }
        if (Array.isArray(route.children)) {
          route.children.forEach(removeFromIndex);
        }
      };
      removeFromIndex(subtree);

      // Then re-index the subtree
      // eslint-disable-next-line no-underscore-dangle
      this._indexRoutes(subtree);
    } else {
      // Rebuild entire index
      // eslint-disable-next-line no-underscore-dangle
      this._routeIndex.clear();
      // eslint-disable-next-line no-underscore-dangle
      this._indexRoutes(this.root);
    }
  }

  /**
   * Add a new route dynamically at runtime.
   *
   * @param {Object} route - The route configuration to add
   * @param {string} [parentPath] - Optional parent path to add the route under
   * @returns {boolean} True if route was added successfully
   * @throws {TypeError} If route configuration is invalid
   * @throws {Error} If parent route is not found
   */
  addRoute(route, parentPath) {
    // Validate the new route
    validateRoutes([route]);

    let targetRoutes;
    let parent;

    if (parentPath) {
      // Find the parent route
      parent = this.findRoute(parentPath);
      if (!parent) {
        const error = createRouterError(
          `Parent route not found: ${parentPath}`,
          HTTP_STATUS.NOT_FOUND,
          { parentPath },
        );
        throw error;
      }

      // Ensure parent has children array
      if (!Array.isArray(parent.children)) {
        parent.children = [];
      }
      targetRoutes = parent.children;
    } else {
      // Add to root level
      parent = this.root;
      if (!Array.isArray(this.root.children)) {
        this.root.children = [];
      }
      targetRoutes = this.root.children;
    }

    // Check for duplicate paths
    const existingRoute = targetRoutes.find(r => r.path === route.path);
    if (existingRoute) {
      return false;
    }

    // Set parent reference
    route.parent = parent;

    // Add the route
    targetRoutes.push(route);

    // Update index and clear cache
    // eslint-disable-next-line no-underscore-dangle
    this._indexRoutes(route);
    this.clearCache();

    return true;
  }

  /**
   * Remove a route dynamically at runtime.
   *
   * @param {string} path - The path of the route to remove
   * @returns {boolean} True if route was removed successfully
   */
  removeRoute(path) {
    const route = this.findRoute(path);
    if (!route) {
      return false;
    }

    // Find parent's children array
    const parent = route.parent || this.root;
    if (!Array.isArray(parent.children)) {
      return false;
    }

    // Remove the route
    const index = parent.children.indexOf(route);
    if (index > -1) {
      parent.children.splice(index, 1);

      // Rebuild index and clear cache
      // eslint-disable-next-line no-underscore-dangle
      this._rebuildIndex();
      this.clearCache();

      return true;
    }

    return false;
  }

  /**
   * Update an existing route's configuration.
   *
   * @param {string} path - The path of the route to update
   * @param {Object} updates - The properties to update
   * @returns {boolean} True if route was updated successfully
   */
  updateRoute(path, updates) {
    const route = this.findRoute(path);
    if (!route) {
      return false;
    }

    // Clear cached match function if path is being updated
    if (updates.path && route.match) {
      delete route.match;
    }

    // Apply updates
    Object.assign(route, updates);

    // Rebuild index if path changed, and clear cache
    if (updates.path) {
      // eslint-disable-next-line no-underscore-dangle
      this._rebuildIndex();
    }
    this.clearCache();

    return true;
  }

  /**
   * Find a route by its path using O(1) index lookup.
   *
   * @param {string} path - The path to search for
   * @param {Object} [searchRoot] - The route to start searching from (for recursive search)
   * @returns {Object|null} The found route or null
   */
  findRoute(path, searchRoot) {
    // Use index for O(1) lookup if no custom searchRoot is provided
    // eslint-disable-next-line no-underscore-dangle
    if (!searchRoot && this._routeIndex.has(path)) {
      // eslint-disable-next-line no-underscore-dangle
      return this._routeIndex.get(path);
    }

    // Fallback to recursive search (used for custom searchRoot)
    const root = searchRoot || this.root;

    // Check if root matches the path
    if (root.path === path) {
      return root;
    }

    // Search children recursively
    if (Array.isArray(root.children)) {
      for (const child of root.children) {
        const found = this.findRoute(path, child);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  /**
   * Get the full path for a route including all parent paths.
   *
   * @param {Object|string} routeOrPath - Route object or path string
   * @returns {string} The full path
   */
  getFullPath(routeOrPath) {
    const route =
      typeof routeOrPath === 'string'
        ? this.findRoute(routeOrPath)
        : routeOrPath;

    if (!route) {
      return null;
    }

    const paths = [];
    let current = route;
    while (current && current.path) {
      paths.unshift(current.path);
      current = current.parent;
    }
    return paths.join('').replace(/\/+/g, '/') || '/';
  }

  /**
   * Get all ancestors of a route.
   *
   * @param {Object|string} routeOrPath - Route object or path string
   * @returns {Array<Object>} Array of ancestor routes
   */
  getAncestors(routeOrPath) {
    const route =
      typeof routeOrPath === 'string'
        ? this.findRoute(routeOrPath)
        : routeOrPath;

    if (!route) {
      return [];
    }

    const ancestors = [];
    let current = route.parent;
    while (current) {
      ancestors.unshift(current);
      current = current.parent;
    }
    return ancestors;
  }

  /**
   * Clear all cached route match functions.
   * Useful after bulk route updates or when route patterns change.
   */
  clearCache() {
    const clearRouteCache = route => {
      if (route.match) {
        delete route.match;
      }
      if (Array.isArray(route.children)) {
        route.children.forEach(clearRouteCache);
      }
    };

    clearRouteCache(this.root);
  }

  /**
   * Get all routes as a flat array.
   *
   * @param {boolean} [includeRoot=false] - Whether to include the root route
   * @returns {Array<Object>} Array of all routes
   */
  getRoutes(includeRoot = false) {
    const routes = [];

    // Flatten the hierarchical tree into an array
    const flattenTree = (node, parentPath = '') => {
      const currentPath = node.path === '(root)' ? '' : node.path;
      const fullPath = parentPath + currentPath;

      // Skip root if not requested
      if (node.path !== '(root)' || includeRoot) {
        routes.push({
          path: currentPath,
          fullPath: fullPath || '/',
          hasAction: node.hasAction,
          hasChildren: node.children && node.children.length > 0,
        });
      }

      // Recursively flatten children
      if (node.children) {
        node.children.forEach(child => flattenTree(child, fullPath));
      }
    };

    // Get the hierarchical tree and flatten it
    const tree = getRouteTree(this.root);
    flattenTree(tree);

    return routes;
  }

  /**
   * Test if a pathname matches any route without executing the action.
   * Useful for testing route configurations.
   *
   * @param {string} pathname - The pathname to test
   * @returns {Object|null} Match result with route, params, and path, or null if no match
   */
  matchPath(pathname) {
    const normalizedPathname = normalizePath(
      pathname.startsWith(this.baseUrl)
        ? pathname.slice(this.baseUrl.length)
        : pathname,
    );

    const matchResult = matchRoute(
      this.root,
      this.baseUrl,
      this.options,
      normalizedPathname,
    );

    const match = matchResult.next();
    if (match.done || !match.value) {
      return null;
    }

    return {
      route: match.value.route,
      params: match.value.params,
      path: match.value.path,
      baseUrl: match.value.baseUrl,
    };
  }

  /**
   * Generate a URL path from a route path pattern and parameters.
   * Useful for creating links programmatically.
   *
   * @param {string} routePath - The route path pattern (e.g., '/users/:id')
   * @param {Object} [params={}] - Parameters to substitute in the path
   * @returns {string} The generated path
   */
  generatePath(routePath, params = {}) {
    let path = routePath;
    const unusedParams = {};

    // Replace path parameters with values and collect unused ones
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value != null) {
        const colonParam = `:${key}`;
        const wildcardParam = `*${key}`;

        // Check if this parameter is used in the path
        if (path.includes(colonParam)) {
          path = path.replace(colonParam, encodeURIComponent(String(value)));
        } else if (path.includes(wildcardParam)) {
          path = path.replace(wildcardParam, encodeURIComponent(String(value)));
        } else {
          // Parameter not used in path, add to unused params
          unusedParams[key] = value;
        }
      }
    });

    // Build query string
    const queryString = buildQueryString(unusedParams);

    // Combine base URL, path, and query string
    const fullPath = this.baseUrl + path;
    return queryString ? `${fullPath}?${queryString}` : fullPath;
  }

  /**
   * Print the route tree to console for debugging.
   * Shows the hierarchy of routes with their paths.
   */
  printRoutes() {
    const printRoute = (node, indent = 0) => {
      const prefix = '  '.repeat(indent);
      const hasAction = node.hasAction ? '✓' : '✗';
      const autoDelegate = node.autoDelegate && node.children ? '(auto)' : '';

      console.log(
        `${prefix}${node.path} [action: ${hasAction}] ${autoDelegate}`,
      );

      if (node.children) {
        node.children.forEach(child => printRoute(child, indent + 1));
      }
    };

    console.log('[Router] Route Tree:');
    const tree = getRouteTree(this.root);
    printRoute(tree);
  }

  /**
   * Resolve a pathname to a route result.
   *
   * @param {string|Object} pathnameOrContext - The pathname string or context object
   * @returns {Promise<*>} A promise that resolves to the route action result
   * @throws {Error} If no route matches (404 error)
   */
  resolve(pathnameOrContext) {
    const context = {
      router: this,
      ...this.options.context,
      ...(typeof pathnameOrContext === 'string'
        ? { pathname: pathnameOrContext }
        : pathnameOrContext),
    };

    // Validate pathname
    if (!isValidPathname(context.pathname)) {
      const error = createRouterError(
        'Invalid pathname: pathname must be a non-empty string',
        HTTP_STATUS.BAD_REQUEST,
        { pathname: context.pathname },
      );
      return Promise.reject(error);
    }

    // Validate that pathname starts with baseUrl
    if (this.baseUrl && !context.pathname.startsWith(this.baseUrl)) {
      const error = createRouterError(
        `Pathname "${context.pathname}" does not match base URL "${this.baseUrl}"`,
        HTTP_STATUS.BAD_REQUEST,
        { pathname: context.pathname, baseUrl: this.baseUrl },
      );
      return Promise.reject(error);
    }

    // Remove base URL from pathname for matching and normalize
    // Ensure the path starts with a slash
    const pathnameWithoutBase = normalizePath(
      context.pathname.slice(this.baseUrl.length),
    );

    // Match the route
    const matchResult = matchRoute(
      this.root,
      this.baseUrl,
      this.options,
      pathnameWithoutBase,
    );

    // Resolve the route
    const resolveFn =
      typeof this.options.resolveRoute === 'function'
        ? this.options.resolveRoute
        : resolveRoute;

    // Create resolution context to avoid race conditions
    const resolutionCtx = {
      matches: null,
      nextMatches: null,
      currentContext: context,
    };

    // Internal next() function for route resolution.
    // This function allows routes to pass control to the next matching route.
    // It's called by route actions to continue the resolution chain.
    //
    // Parameters:
    // - resume: Whether to resume matching (true) or check child routes (false)
    // - parent: The parent route to check children against
    // - prevResult: The result from the previous route action
    const next = (resume, parent, prevResult) => {
      // Determine the parent route for child checking
      // If not provided, use the current matched route
      if (parent == null) {
        parent =
          resolutionCtx.matches &&
          !resolutionCtx.matches.done &&
          resolutionCtx.matches.value &&
          resolutionCtx.matches.value.route
            ? resolutionCtx.matches.value.route
            : false;
      }

      // Determine which route to skip in the next match iteration
      // Skip the current route if prevResult is null (no result from action)
      const routeToSkip =
        prevResult === null &&
        resolutionCtx.matches &&
        !resolutionCtx.matches.done &&
        resolutionCtx.matches.value &&
        resolutionCtx.matches.value.route;

      // Get the next matching route
      // Use cached nextMatches if available, otherwise get next from iterator
      resolutionCtx.matches =
        resolutionCtx.nextMatches || matchResult.next(routeToSkip);
      resolutionCtx.nextMatches = null;

      // If not resuming, check if we should continue to child routes
      // Stop if we've exhausted matches or if the next match is not a child of parent
      if (!resume) {
        if (
          resolutionCtx.matches.done ||
          !isChildRoute(parent, resolutionCtx.matches.value.route)
        ) {
          // Cache this match for potential future use
          resolutionCtx.nextMatches = resolutionCtx.matches;
          return Promise.resolve(null);
        }
      }

      // If we've exhausted all matches, return a 404 error
      if (resolutionCtx.matches.done) {
        const error = createRouterError(
          `No route found for pathname: ${context.pathname}`,
          HTTP_STATUS.NOT_FOUND,
          {
            pathname: context.pathname,
            suggestion:
              'Check that the route is registered and the path pattern matches.',
          },
        );
        return Promise.reject(error);
      }

      // Update the current context with the matched route information
      resolutionCtx.currentContext = {
        ...context,
        ...resolutionCtx.matches.value,
      };

      // Execute the route's action function and handle the result
      return Promise.resolve(
        resolveFn(
          resolutionCtx.currentContext,
          resolutionCtx.matches.value.params,
        ),
      ).then(result => {
        // If route action returned a result, use it
        if (result != null) {
          return result;
        }
        // Otherwise, continue to next matching route
        return next(resume, parent, result);
      });
    };

    // Attach next() to context for use in route actions
    context.next = next;

    return Promise.resolve()
      .then(() => next(true, this.root))
      .catch(error => {
        if (typeof this.options.errorHandler === 'function') {
          return this.options.errorHandler(error, resolutionCtx.currentContext);
        }

        throw error;
      });
  }
}

/**
 * @typedef {Object} Route
 * @property {string} [path] - Route path pattern (e.g., '/users/:id')
 * @property {Function} [action] - Route action function
 * @property {Array<Route>} [children] - Child routes
 * @property {Route} [parent] - Parent route reference
 * @property {boolean} [autoDelegate=true] - Auto-check children before parent action (default: true)
 * @property {Function} [match] - Cached match function (internal)
 */

/**
 * @typedef {Object} RouteContext
 * @property {IsomorphicRouter} router - Router instance
 * @property {string} pathname - Current pathname being resolved
 * @property {Object} params - Route parameters from path pattern
 * @property {string} path - Matched path
 * @property {string} baseUrl - Base URL of the matched route
 * @property {Route} route - Current route object
 * @property {Function} next - Function to continue to next matching route
 */

/**
 * @typedef {Object} RouterOptions
 * @property {string} [baseUrl=''] - Base URL for all routes
 * @property {Function} [decode] - Custom URL decode function
 * @property {Function} [resolveRoute] - Custom route resolver
 * @property {Function} [errorHandler] - Custom error handler
 * @property {Object} [context] - Additional context for route actions
 */
