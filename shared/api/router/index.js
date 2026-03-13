/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { buildRoutes, validateConfig, linkParents } from './builder';
import { collect } from './collector';
import { ROUTE_MOUNT_KEY } from './constants';
import { loadRouteTranslations, runInit, runMount } from './lifecycle';
import { createMatchCache, clearMatchCache, findRoute } from './matcher';

/** @type {symbol} Tag for tracking which adapter a route came from */
const ROUTE_SOURCE_KEY = Symbol('__rsk.routeSource__');

/** @type {symbol} Per-instance radix tree cache */
const ROUTE_CACHE_KEY = Symbol('__rsk.routeCache__');

/**
 * Recursively tags all routes with their source adapter.
 * @param {Object} route - Route node to tag
 * @param {Object} source - The adapter that produced this route
 */
function tagRoutes(route, source) {
  if (!route || typeof route !== 'object') return;
  route[ROUTE_SOURCE_KEY] = source;
  if (Array.isArray(route.children)) {
    route.children.forEach(child => tagRoutes(child, source));
  }
}

/**
 * Validates that an adapter has the required files() and load() methods.
 * @param {Object} adapter
 * @throws {TypeError}
 */
function validateAdapter(adapter) {
  if (!adapter) {
    throw new TypeError('adapter must have files() and load() methods');
  }
  if (
    typeof adapter.files !== 'function' ||
    typeof adapter.load !== 'function'
  ) {
    throw new TypeError('adapter must have files() and load() methods');
  }
  return true;
}

/**
 * @typedef {Object} RouterOptions
 * @property {Function} [onRouteInit] - Hook called before route initialization
 * @property {Function} [onRouteMount] - Hook called on route mount
 */

/**
 * File-based dynamic API router for Express.
 * Resolves incoming requests against a radix tree compiled from filesystem routes.
 *
 * @class
 * @example
 * const router = new Router(adapter);
 * app.use('/api', router.resolve);
 */
export class Router {
  /**
   * @param {Object} adapter - Module loader with files() and load() methods
   * @param {RouterOptions} [options={}]
   */
  constructor(adapter, options) {
    /** @type {RouterOptions} */
    this.options = options || {};
    /** @type {import('./matcher').MatchCache} */
    this[ROUTE_CACHE_KEY] = createMatchCache();

    validateAdapter(adapter);

    this.routes = buildRoutes(
      collect(adapter, 'routes'),
      collect(adapter, 'configs'),
      collect(adapter, 'middlewares'),
    );

    validateConfig(this.routes);
    this.routes.forEach(route => linkParents(route));
    this.routes.forEach(route => tagRoutes(route, adapter));
    clearMatchCache(this[ROUTE_CACHE_KEY]);

    // Bind resolve so it can be passed directly to app.use()
    this.resolve = this.resolve.bind(this);
  }

  /**
   * Dynamically adds routes from a new adapter (e.g. a plugin).
   * @param {Object} adapter - Module loader for the new routes
   * @returns {Object[]} The newly added route nodes
   */
  add(adapter) {
    validateAdapter(adapter);

    const newRoutes = buildRoutes(
      collect(adapter, 'routes'),
      collect(adapter, 'configs'),
      collect(adapter, 'middlewares'),
    );

    if (newRoutes.length === 0) return newRoutes;

    newRoutes.forEach(route => tagRoutes(route, adapter));

    const insertDeep = (routesList, routeToInsert) => {
      let bestParent = null;

      const findParent = list => {
        for (const r of list) {
          if (routeToInsert.path === r.path) {
            return r;
          }
          const isPrefix =
            r.path === '/' || routeToInsert.path.startsWith(r.path + '/');
          if (isPrefix) {
            bestParent = r;
            if (r.children) {
              const deeper = findParent(r.children);
              if (deeper) return deeper;
            }
          }
        }
        return bestParent;
      };

      const existing = findParent(this.routes);

      if (existing) {
        if (existing.path === routeToInsert.path) {
          if (
            Array.isArray(routeToInsert.children) &&
            routeToInsert.children.length > 0
          ) {
            existing.children = existing.children || [];
            for (const child of routeToInsert.children) {
              insertDeep(existing.children, child);
            }
          }
        } else {
          existing.children = existing.children || [];
          existing.children.push(routeToInsert);
        }
      } else {
        routesList.push(routeToInsert);
      }
    };

    for (const newRoute of newRoutes) {
      insertDeep(this.routes, newRoute);
    }

    validateConfig(this.routes);
    this.routes.forEach(route => linkParents(route));

    clearMatchCache(this[ROUTE_CACHE_KEY]);
    return newRoutes;
  }

  /**
   * Removes all routes originating from the given adapter.
   * @param {Object} adapter - The adapter whose routes should be removed
   * @returns {boolean} True if any routes were removed
   */
  remove(adapter) {
    if (!adapter) return false;

    let removed = false;

    const filterRoutes = routes => {
      const result = [];
      for (const route of routes) {
        if (route[ROUTE_SOURCE_KEY] === adapter) {
          removed = true;
          continue;
        }

        if (Array.isArray(route.children) && route.children.length > 0) {
          const originalLength = route.children.length;
          route.children = filterRoutes(route.children);
          if (route.children.length !== originalLength) {
            removed = true;
          }
        }

        result.push(route);
      }
      return result;
    };

    this.routes = filterRoutes(this.routes);

    if (removed) {
      this.routes.forEach(route => linkParents(route));
      clearMatchCache(this[ROUTE_CACHE_KEY]);
    }

    return removed;
  }

  /**
   * Express middleware that matches incoming requests against the radix tree
   * and executes the matched route's action pipeline.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   * @returns {Promise<*>}
   */
  async resolve(req, res, next) {
    const match = findRoute(this.routes, req.path, this[ROUTE_CACHE_KEY]);

    if (!match) {
      return next(); // No route matched, pass to Express
    }

    const { route, params } = match;

    // Inject matched params onto req.params
    Object.assign(req.params, params || {});

    // Provide a mocked application context for lifecycle hooks
    const ctx = {
      app: req.app,
      req,
      res,
      pathname: req.path,
      route,
      params,
      _instance: this,
      [ROUTE_MOUNT_KEY]: new Set(),
    };

    try {
      // Run translations hook (once per route, parent → child)
      await loadRouteTranslations(route, ctx);

      // Run init hook (once per route, parent → child)
      await runInit(route, ctx);

      // Run mount hook (once per route, parent → child)
      await runMount(route, ctx);

      // Execute the action (composed middlewares + handler)
      const actionResult = await route.action(req, res, err => {
        if (err) throw err;
        // If action calls next() without error, route didn't handle the request
        return next();
      });

      return actionResult;
    } catch (err) {
      return next(err);
    }
  }
}

export default Router;
