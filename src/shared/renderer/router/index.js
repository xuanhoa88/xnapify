/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ROUTE_MOUNT_KEY, ROUTE_UNMOUNT_KEY } from './constants';
import { createError, decodeUrl, isDescendant } from './utils';
import { collect } from './collector';
import { runBoot, runMount, runUnmount } from './lifecycle';
import { createMatcher, clearMatchCache } from './matcher';
import { buildRoutes, validateConfig, linkParents } from './builder';

export async function defaultResolver(ctx, options) {
  if (!ctx.route || typeof ctx.route.action !== 'function') return undefined;

  const hasChildren =
    Array.isArray(ctx.route.children) && ctx.route.children.length > 0;

  if (hasChildren && options.autoResolve) {
    const childResult = await ctx.next();
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

// ============================================================================
// Router Class
// ============================================================================

/**
 * Router class for file-based routing
 */
export class Router {
  _previousRoute = null;
  _previousContext = null;

  constructor(moduleLoader, options) {
    this.options = options || {};
    this.baseUrl = this.options.baseUrl || '';
    this.routes = [];
    this.configs = new Map();
    this.layouts = new Map();

    if (moduleLoader) {
      const routes = collect(moduleLoader, 'routes');
      this.configs = collect(moduleLoader, 'configs');
      this.layouts = collect(moduleLoader, 'layouts');
      this.routes = buildRoutes(routes, this.configs, this.layouts);
    } else if (this.options.routes) {
      this.routes = this.options.routes;
    }

    validateConfig(this.routes);
    this.routes.forEach(route => linkParents(route));
    clearMatchCache();
  }

  /**
   * Resolves a URL to a route and executes its action
   * Handles the complete lifecycle: matching -> booting -> unmounting -> mounting -> resolving
   */
  async resolve(context) {
    if (typeof context === 'string') {
      context = { pathname: context };
    }

    const resolver = this.options.routeResolver || defaultResolver;
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
      if (this._previousRoute && this._previousRoute !== state.current.route) {
        // eslint-disable-next-line no-underscore-dangle
        await runUnmount(this._previousRoute, this._previousContext || ctx);
      }

      // Run mount hook (per-request, every navigation)
      await runMount(state.current.route, state.current);

      // Track current route for unmount on next navigation
      // eslint-disable-next-line no-underscore-dangle
      this._previousRoute = state.current.route;
      // eslint-disable-next-line no-underscore-dangle
      this._previousContext = state.current;

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
      if (this.options.errorHandler) {
        return this.options.errorHandler(error, ctx);
      }
      throw error;
    }
  }
}

export default Router;
