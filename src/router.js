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
const HTTP_STATUS = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
};

/**
 * Route matching constants
 * @constant {Object}
 */
const ROUTE_CONSTANTS = {
  EMPTY_PATH: '',
  TRAILING_SLASH: '/',
  LAST_CHAR_INDEX: -1,
};

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
  return value !== null && typeof value === 'object';
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

  return {
    next(routeToSkip) {
      // Skip this route if it matches the route to skip
      if (route === routeToSkip) {
        return { done: true, value: false };
      }

      // Try to match the current route
      if (!matchResult) {
        const end = !route.children;

        // Cache the match function on the route object
        if (!route.match) {
          route.match = match(route.path || '', { end, ...options });
        }

        matchResult = route.match(pathname);

        if (matchResult) {
          let { path } = matchResult;

          // Remove trailing slash for non-end routes
          const hasTrailingSlash =
            path.charAt(path.length + ROUTE_CONSTANTS.LAST_CHAR_INDEX) ===
            ROUTE_CONSTANTS.TRAILING_SLASH;
          if (!end && hasTrailingSlash) {
            path = path.slice(1);
          }
          matchResult.path = path;

          // Merge parent and current route parameters
          matchResult.params = { ...parentParams, ...matchResult.params };

          return {
            done: false,
            value: {
              route,
              baseUrl,
              path: matchResult.path,
              params: matchResult.params,
            },
          };
        }
      }

      // Try to match child routes
      if (matchResult && route.children) {
        while (childIndex < route.children.length) {
          if (!childMatches) {
            const childRoute = route.children[childIndex];
            childRoute.parent = route;

            const childPathname = pathname.slice(matchResult.path.length);
            childMatches = matchRoute(
              childRoute,
              baseUrl + matchResult.path,
              options,
              childPathname,
              matchResult.params,
            );
          }

          const childMatch = childMatches.next(routeToSkip);
          if (!childMatch.done) {
            return { done: false, value: childMatch.value };
          }

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
  if (typeof context.route.action !== 'function') {
    return undefined;
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
 * @example
 * const router = new IsomorphicRouter([
 *   {
 *     path: '/',
 *     action: () => <HomePage />,
 *   },
 *   {
 *     path: '/about',
 *     action: () => <AboutPage />,
 *   },
 * ]);
 *
 * router.resolve('/about').then(result => {
 *   // result is the component returned by the action
 * });
 */
class IsomorphicRouter {
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
    if (!isValidRoute(routes)) {
      throw new TypeError('Invalid routes: routes must be an object or array');
    }

    this.options = { decode, ...options };
    this.baseUrl = this.options.baseUrl || ROUTE_CONSTANTS.EMPTY_PATH;
    this.root = Array.isArray(routes)
      ? {
          path: ROUTE_CONSTANTS.EMPTY_PATH,
          children: routes,
          parent: null,
        }
      : routes;
    this.root.parent = null;
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
      return Promise.reject(
        createRouterError(
          'Invalid pathname: pathname must be a non-empty string',
          HTTP_STATUS.BAD_REQUEST,
          { pathname: context.pathname },
        ),
      );
    }

    // Remove base URL from pathname for matching
    const pathnameWithoutBase = context.pathname.slice(this.baseUrl.length);

    const matchResult = matchRoute(
      this.root,
      this.baseUrl,
      this.options,
      pathnameWithoutBase,
    );

    const resolveFn =
      typeof this.options.resolveRoute === 'function'
        ? this.options.resolveRoute
        : resolveRoute;
    let matches;
    let nextMatches = null;
    let currentContext = context;

    const next = (resume, parent, prevResult) => {
      // Set default parent value
      if (parent === undefined) {
        parent =
          matches && !matches.done && matches.value && matches.value.route
            ? matches.value.route
            : false;
      }
      const routeToSkip =
        prevResult === null && matches && !matches.done && matches.value.route;
      matches = nextMatches || matchResult.next(routeToSkip);
      nextMatches = null;

      if (!resume) {
        if (matches.done || !isChildRoute(parent, matches.value.route)) {
          nextMatches = matches;
          return Promise.resolve(null);
        }
      }

      if (matches.done) {
        return Promise.reject(
          createRouterError('Route not found', HTTP_STATUS.NOT_FOUND, {
            pathname: context.pathname,
          }),
        );
      }

      currentContext = { ...context, ...matches.value };

      return Promise.resolve(
        resolveFn(currentContext, matches.value.params),
      ).then(result => {
        // If route action returned a result, use it
        if (result != null) {
          return result;
        }
        // Otherwise, continue to next matching route
        return next(resume, parent, result);
      });
    };

    context.next = next;

    return Promise.resolve()
      .then(() => next(true, this.root))
      .catch(error => {
        if (typeof this.options.errorHandler === 'function') {
          return this.options.errorHandler(error, currentContext);
        }
        throw error;
      });
  }
}

/**
 * Create and export the router instance.
 * This instance is shared across the application for consistent routing.
 *
 * The router handles both server-side and client-side routing,
 * enabling seamless SSR and client-side navigation.
 */
export default new IsomorphicRouter(require('./pages').default);
