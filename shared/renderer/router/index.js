/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  BaseRouter,
  tagRoutes,
  validateAdapter,
} from '@shared/utils/BaseRouter';

import { buildRoutes, validateConfig, linkParents } from './builder';
import { collect } from './collector';
import {
  ROUTE_MOUNT_KEY,
  ROUTE_UNMOUNT_KEY,
  ROUTE_PREV_KEY,
  ROUTE_PREV_CTX,
} from './constants';
import {
  loadRouteTranslations,
  runInit,
  runMount,
  runUnmount,
} from './lifecycle';
import { createMatcher } from './matcher';
import { createError, decodeUrl, isDescendant, log } from './utils';

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
export class Router extends BaseRouter {
  constructor(adapter, options) {
    validateAdapter(adapter);

    // Collect and store layouts for reuse in add()
    const layouts = collect(adapter, 'layouts');

    const routes = buildRoutes(
      collect(adapter, 'routes'),
      collect(adapter, 'configs'),
      layouts,
    );

    // Initialize BaseRouter with pre-built routes and builder hooks
    super(routes, { validateConfig, linkParents });

    this.options = options || {};
    this.baseUrl = this.options.baseUrl || '';

    // Tag initial routes with their source adapter
    this.routes.forEach(route => tagRoutes(route, adapter || null));

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

    // Routes added via add() that still need register() lifecycle calls
    // eslint-disable-next-line no-underscore-dangle
    this._pendingRoutes = [];

    // Store layouts for extension route injection
    // eslint-disable-next-line no-underscore-dangle
    this._layouts = layouts;
  }

  /**
   * Register routes with the application context
   * @param {Object} context - App context
   * @param {boolean} force - Force re-registration even if already registered
   */
  async setup(context, force = false) {
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
        // Call custom register hook if provided
        if (typeof this.options.setup === 'function') {
          await this.options.setup(context, this);
        }

        registeredContexts.set(scope, true);
        await traverseRoutes(this.routes, 'setup', context, false);
      } catch (err) {
        // Remove from registered contexts on failure
        registeredContexts.delete(scope);
        log(`Error during registration: ${err.message}`, 'error');
        throw err;
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
  async teardown(context, force = false) {
    const scope = context && typeof context === 'object' ? context : this;

    if (!force && !registeredContexts.has(scope)) {
      return; // Not registered, skip
    }

    try {
      registeredContexts.delete(scope);
      await traverseRoutes(this.routes, 'teardown', context, true);

      // Call custom unregister hook if provided
      if (typeof this.options.teardown === 'function') {
        await this.options.teardown(context, this);
      }
    } catch (err) {
      log(`Error during unregistration: ${err.message}`, 'error');
      throw err;
    }
  }

  /**
   * Dynamically add routes from a module adapter.
   *
   * Collects routes, configs, and layouts from the adapter, builds them,
   * then delegates to BaseRouter._addRoutes() for tree insertion.
   *
   * @param {Object} adapter - Adapter with files() and load() methods
   * @param {Object} [ctx] - Optional context for immediate register lifecycle
   * @param {string} [sourceId] - Optional string ID for robust removal
   * @returns {Object[]} The newly built route trees
   */
  async add(adapter, ctx, sourceId) {
    validateAdapter(adapter);

    // Build new routes — merge core layouts with extension-provided layouts
    // eslint-disable-next-line no-underscore-dangle
    const extLayouts = collect(adapter, 'layouts');
    const mergedLayouts = new Map([
      // eslint-disable-next-line no-underscore-dangle
      ...(this._layouts || []),
      ...extLayouts,
    ]);
    const newRoutes = buildRoutes(
      collect(adapter, 'routes'),
      collect(adapter, 'configs'),
      mergedLayouts,
    );

    if (newRoutes.length === 0) return newRoutes;

    // Delegate tree insertion to BaseRouter
    // eslint-disable-next-line no-underscore-dangle
    const insertedRoutes = this._addRoutes(newRoutes, adapter, sourceId);

    // Track genuinely inserted routes for deferred register() lifecycle
    // eslint-disable-next-line no-underscore-dangle
    if (insertedRoutes.length > 0) {
      // eslint-disable-next-line no-underscore-dangle
      this._pendingRoutes.push(...insertedRoutes);
    }

    // If ctx is provided, immediately register pending routes
    // eslint-disable-next-line no-underscore-dangle
    if (ctx && this._pendingRoutes.length > 0) {
      // eslint-disable-next-line no-underscore-dangle
      const pending = this._pendingRoutes.splice(0);
      await traverseRoutes(pending, 'setup', ctx, false);
    }

    return newRoutes;
  }

  /**
   * Remove routes by adapter reference (object) or source ID (string).
   * Runs unregister lifecycle before delegating removal to BaseRouter.
   *
   * @param {Object|string} adapterOrSourceId - Adapter reference or source ID
   * @param {Object} [ctx] - Optional context for unregister lifecycle
   * @returns {Promise<boolean>} True if any routes were removed
   */
  async remove(adapterOrSourceId, ctx) {
    if (!adapterOrSourceId) return false;

    // Run unregister lifecycle on affected routes before removal
    if (ctx) {
      const tagged =
        typeof adapterOrSourceId === 'string'
          ? this.collectBySourceId(adapterOrSourceId)
          : this.collectByAdapter(adapterOrSourceId);
      if (tagged.length > 0) {
        await traverseRoutes(tagged, 'teardown', ctx, true);
      }
    }

    // Delegate tree removal to BaseRouter
    // eslint-disable-next-line no-underscore-dangle
    return this._remove(adapterOrSourceId);
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
    // Store context for deferred lifecycle calls (e.g. add/remove with ctx)
    // eslint-disable-next-line no-underscore-dangle
    this._lastResolveContext = context;
    const ctx = {
      ...this.options.context,
      ...context,
      _instance: this,
      _navigationEntry: navigationEntry,
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

    // Auto-invoke setup (idempotent — no-ops if already registered)
    await this.setup(ctx);

    // Register routes added via add() after initial registration
    // eslint-disable-next-line no-underscore-dangle
    if (this._pendingRoutes.length > 0) {
      // eslint-disable-next-line no-underscore-dangle
      const pending = this._pendingRoutes.splice(0);
      await traverseRoutes(pending, 'setup', ctx, false);
    }

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
      mountedRoute: null, // Track what we've mounted for rollback
      previousRouteSnapshot: {
        route: this[ROUTE_PREV_KEY],
        ctx: this[ROUTE_PREV_CTX] ? cloneContext(this[ROUTE_PREV_CTX]) : null,
      },
    };

    // eslint-disable-next-line no-param-reassign
    const next = async (resume = false, parent = null, prevResult = null) => {
      // Iterative loop replaces recursive next() calls.
      // O(1) memory regardless of match count.
      let __iterations = 0; // eslint-disable-line no-underscore-dangle
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Dev-only: catch infinite loops with a clear error
        // eslint-disable-next-line no-underscore-dangle, no-plusplus
        if (__DEV__ && ++__iterations > 100) {
          throw createError(`Possible infinite loop: ${ctx.pathname}`, 500, {
            pathname: ctx.pathname,
          });
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

        // Reuse context object to avoid per-iteration allocation
        if (!state.current) {
          state.current = { ...ctx };
        }
        Object.assign(state.current, state.matches.value);

        // Check cancellation before init
        if (navigationEntry.cancelled) {
          return null;
        }

        // Run translations hook (once per route, parent → child)
        await loadRouteTranslations(state.current.route, state.current);

        // Run init hook (config + route-level, parent → child, once per route)
        await runInit(state.current.route, state.current);

        // Check cancellation before unmount
        if (navigationEntry.cancelled) {
          return null;
        }

        // Run unmount hook on previous route ONLY on first match
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

        // No result — continue loop to try next match (replaces recursion)
        prevResult = result;
      }
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
      // Cleanup: Clear Sets to prevent memory leaks (only if allocated)
      if (ctx[ROUTE_MOUNT_KEY]) {
        ctx[ROUTE_MOUNT_KEY].clear();
        ctx[ROUTE_MOUNT_KEY] = null;
      }
      if (ctx[ROUTE_UNMOUNT_KEY]) {
        ctx[ROUTE_UNMOUNT_KEY].clear();
        ctx[ROUTE_UNMOUNT_KEY] = null;
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
