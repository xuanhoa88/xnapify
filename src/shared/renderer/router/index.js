/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  ROUTE_MOUNT_KEY,
  ROUTE_UNMOUNT_KEY,
  ROUTE_PREV_KEY,
  ROUTE_PREV_CTX,
} from './constants';
import { createError, decodeUrl, isDescendant, log } from './utils';
import { collect } from './collector';
import { runInit, runMount, runUnmount } from './lifecycle';
import { createMatcher, clearMatchCache } from './matcher';
import { buildRoutes, validateConfig, linkParents } from './builder';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Default route resolver
 * @param {Object} ctx - Route context
 * @param {Object} options - Router options
 */
export async function defaultResolver(ctx, options) {
  if (!ctx || !ctx.route || typeof ctx.route.action !== 'function') {
    return undefined;
  }

  const hasChildren =
    Array.isArray(ctx.route.children) && ctx.route.children.length > 0;

  if (hasChildren && options.autoResolve) {
    // When resolving children, we must ensure the match is actually a descendant
    // of the current route. Otherwise, we might inadvertently resolve a sibling
    // (like /*path) if the matcher advances too far.
    // Passing (false, ctx.route) enforces the isDescendant check in the resolve loop.
    const childResult = await ctx.next(false, ctx.route);
    if (childResult != null) return childResult;
  }

  const result = await ctx.route.action(ctx, options);

  if (result && typeof result === 'object' && 'default' in result) {
    return typeof result.default === 'function'
      ? result.default(ctx, options)
      : result.default;
  }

  return result;
}

/**
 * Traverse routes and invoke a lifecycle method
 * @param {Array} routes - Routes to traverse
 * @param {string} method - 'register' or 'unregister'
 * @param {Object} context - App context
 * @param {boolean} childrenFirst - If true, process children before parent (for cleanup)
 * @returns {Promise<number>} Count of invoked methods
 */
async function traverseRoutes(routes, method, context, childrenFirst = false) {
  let count = 0;

  const processChildren = async route => {
    if (Array.isArray(route.children) && route.children.length > 0) {
      await walk(route.children);
    }
  };

  const walk = async routeList => {
    if (!Array.isArray(routeList)) return;

    for (const route of routeList) {
      // Skip null/undefined routes
      if (!route || typeof route !== 'object') continue;

      try {
        // Process children first for cleanup (unregister)
        if (childrenFirst) {
          await processChildren(route);
        }

        // Invoke lifecycle method if available
        if (route.module && typeof route.module[method] === 'function') {
          await route.module[method](context);
          count += 1;
        }

        // Process children after parent for registration
        if (!childrenFirst) {
          await processChildren(route);
        }
      } catch (err) {
        log(
          `Error ${method} route ${route.path || '(unknown)'}: ${err.message}`,
          'error',
        );
      }
    }
  };

  await walk(routes);
  return count;
}

/**
 * Clone context for safe storage
 * @param {Object} ctx - Context to clone
 * @returns {Object} Cloned context with essential properties
 */
function cloneContext(ctx) {
  if (!ctx) return null;

  // Only clone essential properties to avoid memory bloat
  const cloned = {
    pathname: ctx.pathname,
    route: ctx.route,
    params: ctx.params ? { ...ctx.params } : {},
    query: ctx.query ? { ...ctx.query } : {},
  };

  // Copy other non-function, non-Set properties
  for (const key in ctx) {
    if (
      Object.prototype.hasOwnProperty.call(ctx, key) &&
      typeof ctx[key] !== 'function' &&
      !(ctx[key] instanceof Set) &&
      !Object.prototype.hasOwnProperty.call(cloned, key) &&
      !key.startsWith('_')
    ) {
      cloned[key] = ctx[key];
    }
  }

  return cloned;
}

// ============================================================================
// Router Class
// ============================================================================

// Track registration per context to avoid duplicate work.
// In SSR, each request has its own context object.
// In CSR, the context object is typically long-lived.
const registeredContexts = new WeakMap();

/**
 * Navigation queue entry
 */
class NavigationEntry {
  constructor(pathname, promise) {
    this.pathname = pathname;
    this.promise = promise;
    this.cancelled = false;
  }

  cancel() {
    this.cancelled = true;
  }
}

/**
 * Router class for file-based routing
 */
export class Router {
  constructor(adapter, options) {
    this.options = options || {};
    this.baseUrl = this.options.baseUrl || '';
    this.routes = [];
    this.configs = new Map();
    this.layouts = new Map();

    // Track previous route for unmount lifecycle (CSR only)
    this[ROUTE_PREV_KEY] = null;
    this[ROUTE_PREV_CTX] = null;

    // Navigation queue to prevent race conditions
    // eslint-disable-next-line no-underscore-dangle
    this._navigationQueue = [];
    // eslint-disable-next-line no-underscore-dangle
    this._isNavigating = false;

    // Registration promise cache to prevent concurrent registration
    // eslint-disable-next-line no-underscore-dangle
    this._registrationPromise = null;

    // Max recursion depth for next() calls
    // eslint-disable-next-line no-underscore-dangle
    this._maxDepth = this.options.maxDepth || 50;

    if (adapter) {
      const routes = collect(adapter, 'routes');
      this.configs = collect(adapter, 'configs');
      this.layouts = collect(adapter, 'layouts');
      this.routes = buildRoutes(routes, this.configs, this.layouts);
    } else if (this.options.routes) {
      this.routes = this.options.routes;
    }

    validateConfig(this.routes);
    this.routes.forEach(route => linkParents(route));
    clearMatchCache();
  }

  /**
   * Register routes with the application context
   * @param {Object} context - App context
   * @param {boolean} force - Force re-registration even if already registered
   */
  async register(context, force = false) {
    const scope = context && typeof context === 'object' ? context : this;

    if (!force && registeredContexts.has(scope)) {
      return; // Already registered, skip
    }

    // Reuse existing registration promise if one is in flight
    // eslint-disable-next-line no-underscore-dangle
    if (this._registrationPromise) {
      // eslint-disable-next-line no-underscore-dangle
      return this._registrationPromise;
    }

    // eslint-disable-next-line no-underscore-dangle
    this._registrationPromise = (async () => {
      try {
        registeredContexts.set(scope, true);
        await traverseRoutes(this.routes, 'register', context, false);
      } finally {
        // eslint-disable-next-line no-underscore-dangle
        this._registrationPromise = null;
      }
    })();

    // eslint-disable-next-line no-underscore-dangle
    return this._registrationPromise;
  }

  /**
   * Unregister routes from the application context (children-first order)
   * @param {Object} context - App context
   * @param {boolean} force - Force unregistration even if not registered
   */
  async unregister(context, force = false) {
    const scope = context && typeof context === 'object' ? context : this;

    if (!force && !registeredContexts.has(scope)) {
      return; // Not registered, skip
    }
    registeredContexts.delete(scope);
    await traverseRoutes(this.routes, 'unregister', context, true);
  }

  /**
   * Process navigation queue
   */
  async _processNavigationQueue() {
    // eslint-disable-next-line no-underscore-dangle
    if (this._isNavigating || this._navigationQueue.length === 0) {
      return;
    }

    // eslint-disable-next-line no-underscore-dangle
    this._isNavigating = true;

    // eslint-disable-next-line no-underscore-dangle
    while (this._navigationQueue.length > 0) {
      // eslint-disable-next-line no-underscore-dangle
      const entry = this._navigationQueue.shift();

      // Cancel all remaining queued navigations except the last one
      // eslint-disable-next-line no-underscore-dangle
      if (this._navigationQueue.length > 0) {
        entry.cancel();
        continue;
      }

      if (!entry.cancelled) {
        try {
          await entry.promise;
        } catch (error) {
          // Error already handled in resolve, just log
          log(`Navigation error: ${error.message}`, 'error');
        }
      }
    }

    // eslint-disable-next-line no-underscore-dangle
    this._isNavigating = false;
  }

  /**
   * Resolves a URL to a route and executes its action
   * Handles the complete lifecycle: matching -> initializing -> unmounting -> mounting -> resolving
   */
  async resolve(contextOrPath) {
    const context =
      typeof contextOrPath === 'string'
        ? { pathname: contextOrPath }
        : contextOrPath;

    // Create a promise for this navigation
    let resolveNavigation;
    let rejectNavigation;
    const navigationPromise = new Promise((resolve, reject) => {
      resolveNavigation = resolve;
      rejectNavigation = reject;
    });

    const entry = new NavigationEntry(context.pathname, navigationPromise);

    // Queue the navigation
    // eslint-disable-next-line no-underscore-dangle
    this._navigationQueue.push(entry);

    // Start processing queue (non-blocking)
    // eslint-disable-next-line no-underscore-dangle
    this._processNavigationQueue();

    // Start resolution (non-blocking) - captures resolve/reject from above
    (async () => {
      try {
        // Check if cancelled before starting
        if (entry.cancelled) {
          resolveNavigation(null); // Resolves the promise we created
          return;
        }

        // eslint-disable-next-line no-underscore-dangle
        const result = await this._resolveInternal(context, entry);
        resolveNavigation(result); // Resolves the promise we created
      } catch (error) {
        rejectNavigation(error); // Rejects the promise we created
      }
    })();

    // Return the promise immediately (caller can await it)
    return navigationPromise;
  }

  /**
   * Internal resolve implementation
   */
  async _resolveInternal(context, navigationEntry) {
    const ctx = {
      ...this.options.context,
      ...context,
      _instance: this,
      _navigationEntry: navigationEntry,
      [ROUTE_MOUNT_KEY]: new Set(),
      [ROUTE_UNMOUNT_KEY]: new Set(),
      [ROUTE_PREV_KEY]: null,
      [ROUTE_PREV_CTX]: null,
    };

    if (typeof ctx.pathname !== 'string' || !ctx.pathname) {
      throw createError('Context must have a valid pathname', 400);
    }

    const resolver =
      typeof this.options.routeResolver === 'function'
        ? this.options.routeResolver
        : defaultResolver;

    // Auto-invoke registration (idempotent, errors caught in traverseRoutes)
    await this.register(ctx);

    // Check if navigation was cancelled
    if (navigationEntry.cancelled) {
      return null;
    }

    const matcher = createMatcher(
      { children: this.routes },
      this.baseUrl,
      {
        decode: decodeUrl,
        ...this.options,
      },
      ctx.pathname,
    );

    const state = {
      matcher,
      matches: matcher.next(),
      cachedMatch: null,
      current: null,
      depth: 0,
      mountedRoute: null, // Track what we've mounted for rollback
      previousRouteSnapshot: {
        route: this[ROUTE_PREV_KEY],
        ctx: this[ROUTE_PREV_CTX] ? cloneContext(this[ROUTE_PREV_CTX]) : null,
      },
    };

    const next = async (resume = false, parent = null, prevResult = null) => {
      // Check recursion depth
      state.depth += 1;
      // eslint-disable-next-line no-underscore-dangle
      if (state.depth > this._maxDepth) {
        throw createError(
          // eslint-disable-next-line no-underscore-dangle
          `Maximum recursion depth (${this._maxDepth}) exceeded`,
          500,
          { pathname: ctx.pathname, depth: state.depth },
        );
      }

      // Check if navigation was cancelled
      if (navigationEntry.cancelled) {
        return null;
      }

      if (
        resume &&
        state.matches &&
        state.matches.value &&
        !state.matches.done
      ) {
        parent = state.matches.value.route;
      }

      const skip =
        prevResult === null &&
        state.matches &&
        !state.matches.done &&
        state.matches.value
          ? state.matches.value.route
          : null;

      state.matches = state.cachedMatch || matcher.next(skip);
      state.cachedMatch = null;

      if (!resume) {
        if (
          state.matches.done ||
          (parent && !isDescendant(parent, state.matches.value.route))
        ) {
          state.cachedMatch = state.matches;
          return null;
        }
      }

      if (state.matches.done) {
        throw createError(`No route found: ${ctx.pathname}`, 404, {
          pathname: ctx.pathname,
        });
      }

      state.current = { ...ctx, ...state.matches.value };

      // Check cancellation before init
      if (navigationEntry.cancelled) {
        return null;
      }

      // Run init hook (config + route-level, parent → child, once per route)
      await runInit(state.current.route, state.current);

      // Check cancellation before unmount
      if (navigationEntry.cancelled) {
        return null;
      }

      // Run unmount hook on previous route ONLY on first match
      // This ensures we unmount once per navigation, not on every next() call
      if (!state.mountedRoute && state.previousRouteSnapshot.route) {
        const prevRoute = state.previousRouteSnapshot.route;
        const prevCtx = state.previousRouteSnapshot.ctx || ctx;

        if (prevRoute !== state.current.route) {
          await runUnmount(prevRoute, prevCtx);
        }
      }

      // Check cancellation before mount
      if (navigationEntry.cancelled) {
        return null;
      }

      // Run mount hook (per-request, every navigation)
      await runMount(state.current.route, state.current);

      // Track that we've mounted this route (for potential rollback)
      if (!state.mountedRoute) {
        state.mountedRoute = state.current.route;
      }

      // Check cancellation before resolver
      if (navigationEntry.cancelled) {
        return null;
      }

      const result = await resolver(state.current, {
        autoResolve: state.current.route.autoResolve !== false,
      });

      if (result != null) return result;

      state.depth -= 1; // Decrease depth before recursion
      return next(resume, parent, result);
    };

    ctx.next = next;

    let result;
    let navigationSuccessful = false;

    try {
      result = await next();

      // Check if cancelled after resolution
      if (navigationEntry.cancelled) {
        return null;
      }

      navigationSuccessful = true;

      // Only update prev route tracking on successful navigation
      this[ROUTE_PREV_KEY] =
        state.mountedRoute || (state.current && state.current.route);
      this[ROUTE_PREV_CTX] = state.current ? cloneContext(state.current) : null;
      ctx[ROUTE_PREV_KEY] = this[ROUTE_PREV_KEY];
      ctx[ROUTE_PREV_CTX] = this[ROUTE_PREV_CTX];

      return result;
    } catch (error) {
      // Rollback: If we mounted a new route but navigation failed,
      // we need to clean up and restore the previous route
      if (state.mountedRoute && !navigationSuccessful) {
        try {
          await runUnmount(state.mountedRoute, state.current || ctx);

          // Restore previous route if available
          if (
            state.previousRouteSnapshot.route &&
            state.previousRouteSnapshot.ctx
          ) {
            await runMount(
              state.previousRouteSnapshot.route,
              state.previousRouteSnapshot.ctx,
            );
          }
        } catch (rollbackError) {
          log(
            `Error during navigation rollback: ${rollbackError.message}`,
            'error',
          );
        }
      }

      // Handle error with custom handler or rethrow
      if (typeof this.options.errorHandler === 'function') {
        return this.options.errorHandler(error, ctx);
      }
      throw error;
    } finally {
      // Cleanup: Clear Sets to prevent memory leaks
      if (ctx[ROUTE_MOUNT_KEY]) {
        ctx[ROUTE_MOUNT_KEY].clear();
      }
      if (ctx[ROUTE_UNMOUNT_KEY]) {
        ctx[ROUTE_UNMOUNT_KEY].clear();
      }

      // Reset matcher state
      state.matcher = null;
      state.matches = null;
      state.cachedMatch = null;
      state.current = null;
    }
  }
}

export default Router;
