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
  ROUTE_REGISTERED_KEY,
  ROUTE_UNREGISTERED_KEY,
} from './constants';
import { createError, decodeUrl, isDescendant, log } from './utils';
import { collect } from './collector';
import { runBoot, runMount, runUnmount } from './lifecycle';
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
  if (!ctx || !ctx.route || typeof ctx.route.action !== 'function')
    return undefined;

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
          log(`${method}: ${route.path}`);
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

// ============================================================================
// Router Class
// ============================================================================

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
    this[ROUTE_REGISTERED_KEY] = false;
    this[ROUTE_UNREGISTERED_KEY] = false;

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
    if (this[ROUTE_REGISTERED_KEY] && !force) return;
    this[ROUTE_REGISTERED_KEY] = true;

    log('Starting Route Registration...');
    const count = await traverseRoutes(this.routes, 'register', context, false);
    log(`Route Registration Complete. Registered ${count} modules.`);
  }

  /**
   * Unregister routes from the application context (children-first order)
   * @param {Object} context - App context
   * @param {boolean} force - Force unregistration even if not registered
   */
  async unregister(context, force = false) {
    if (this[ROUTE_UNREGISTERED_KEY] && !force) return;
    this[ROUTE_UNREGISTERED_KEY] = true;

    log('Starting Route Unregistration...');
    const count = await traverseRoutes(
      this.routes,
      'unregister',
      context,
      true,
    );
    log(`Route Unregistration Complete. Unregistered ${count} modules.`);
  }

  /**
   * Resolves a URL to a route and executes its action
   * Handles the complete lifecycle: matching -> booting -> unmounting -> mounting -> resolving
   */
  async resolve(context) {
    if (typeof context === 'string') {
      context = { pathname: context };
    }

    const ctx = {
      ...this.options.context,
      ...context,
      _instance: this,
      [ROUTE_MOUNT_KEY]: new Set(),
      [ROUTE_UNMOUNT_KEY]: new Set(),
    };

    if (typeof ctx.pathname !== 'string' || !ctx.pathname) {
      throw createError('Context must have a valid pathname', 400);
    }

    const resolver =
      typeof this.options.routeResolver === 'function'
        ? this.options.routeResolver
        : defaultResolver;

    // Auto-invoke registration (idempotent, errors caught in _traverseRoutes)
    await this.register(ctx);

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
      current: null, // Tracks the currently processing route/context
    };

    const next = async (resume = false, parent = null, prevResult = null) => {
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

      // Run boot hook (config + route-level, parent → child, once per route)
      await runBoot(state.current.route, state.current);

      // Run unmount hook on previous route (if navigating away)
      // eslint-disable-next-line no-underscore-dangle
      if (
        this[ROUTE_PREV_KEY] &&
        this[ROUTE_PREV_KEY] !== state.current.route
      ) {
        await runUnmount(this[ROUTE_PREV_KEY], this[ROUTE_PREV_CTX] || ctx);
      }

      // Run mount hook (per-request, every navigation)
      await runMount(state.current.route, state.current);

      // Track current route for unmount on next navigation
      this[ROUTE_PREV_KEY] = state.current.route;
      this[ROUTE_PREV_CTX] = state.current;

      const result = await resolver(state.current, {
        autoResolve: state.current.route.autoResolve !== false,
      });

      if (result != null) return result;
      return next(resume, parent, result);
    };

    ctx.next = next;

    try {
      return await next();
    } catch (error) {
      if (typeof this.options.errorHandler === 'function') {
        return this.options.errorHandler(error, ctx);
      }
      throw error;
    }
  }
}

export default Router;
