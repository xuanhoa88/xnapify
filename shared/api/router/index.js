/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { BaseRouter, validateAdapter } from '@shared/utils/BaseRouter';

import { buildRoutes, validateConfig, linkParents } from './builder';
import { collect } from './collector';
import { ROUTE_MOUNT_KEY } from './constants';
import { loadRouteTranslations, runInit, runMount } from './lifecycle';
import { createMatchCache, clearMatchCache, findRoute } from './matcher';

/** @type {symbol} Per-instance radix tree cache */
const ROUTE_CACHE_KEY = Symbol('__xnapify.routeCache__');

/**
 * File-based dynamic API router for Express.
 * Resolves incoming requests against a radix tree compiled from filesystem routes.
 *
 * @class
 * @example
 * const router = new Router(adapter);
 * app.use('/api', router.resolve);
 */
export class Router extends BaseRouter {
  /**
   * @param {Object} adapter - Module loader with files() and load() methods
   * @param {RouterOptions} [options={}]
   */
  constructor(adapter, options) {
    validateAdapter(adapter);

    const routes = buildRoutes(
      collect(adapter, 'routes'),
      collect(adapter, 'configs'),
      collect(adapter, 'middlewares'),
    );

    // Initialize BaseRouter with pre-built routes and builder hooks
    super(routes, { validateConfig, linkParents });

    /** @type {RouterOptions} */
    this.options = options || {};

    /** @type {import('./matcher').MatchCache} */
    this[ROUTE_CACHE_KEY] = createMatchCache();

    clearMatchCache(this[ROUTE_CACHE_KEY]);

    // Bind resolve so it can be passed directly to app.use()
    this.resolve = this.resolve.bind(this);
  }

  /**
   * Dynamically adds routes from a new adapter (e.g. an extension).
   * @param {Object} adapter - Module loader for the new routes
   * @param {string} [sourceId] - Optional string ID for robust removal
   * @returns {Object[]} The newly added route nodes
   */
  add(adapter, sourceId) {
    validateAdapter(adapter);

    const newRoutes = buildRoutes(
      collect(adapter, 'routes'),
      collect(adapter, 'configs'),
      collect(adapter, 'middlewares'),
    );

    if (newRoutes.length === 0) return newRoutes;

    // Delegate tree insertion to BaseRouter
    // eslint-disable-next-line no-underscore-dangle
    this._addRoutes(newRoutes, adapter, sourceId);

    clearMatchCache(this[ROUTE_CACHE_KEY]);
    return newRoutes;
  }

  /**
   * Remove routes by adapter reference (object) or source ID (string).
   * @param {Object|string} adapterOrSourceId - Adapter or source ID
   * @returns {boolean} True if any routes were removed
   */
  remove(adapterOrSourceId) {
    // eslint-disable-next-line no-underscore-dangle
    const removed = this._remove(adapterOrSourceId);
    if (removed) {
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

      // Execute the action (composed middlewares + handler).
      const actionResult = await route.action(req, res, err => {
        if (err) return next(err);
        return next();
      });

      return actionResult;
    } catch (err) {
      return next(err);
    }
  }
}

export default Router;
