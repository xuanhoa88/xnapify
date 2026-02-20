/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ROUTE_MOUNT_KEY, ROUTE_UNMOUNT_KEY } from './constants';
import { decodeUrl, isDescendant } from './utils';
import { collect } from './collector';
import { runInit, runMount } from './lifecycle';
import { createMatcher, clearMatchCache } from './matcher';
import { buildRoutes, validateConfig, linkParents } from './builder';

const ROUTE_SOURCE_KEY = Symbol('__rsk.apiRouteSource__');

function tagRoutes(route, source) {
  if (!route || typeof route !== 'object') return;
  route[ROUTE_SOURCE_KEY] = source;
  if (Array.isArray(route.children)) {
    route.children.forEach(child => tagRoutes(child, source));
  }
}

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

export class ApiRouter {
  constructor(adapter, options) {
    this.options = options || {};
    this.baseUrl = this.options.baseUrl || '';

    validateAdapter(adapter);

    // Note: API matches middlewares instead of layout configs
    this.routes = buildRoutes(
      collect(adapter, 'routes'),
      collect(adapter, 'configs'),
      collect(adapter, 'middlewares'),
    );

    validateConfig(this.routes);
    this.routes.forEach(route => linkParents(route));
    this.routes.forEach(route => tagRoutes(route, adapter || null));
    clearMatchCache();

    // Bind expressMiddleware so it can be passed directly to app.use()
    this.expressMiddleware = this.expressMiddleware.bind(this);
  }

  add(adapter) {
    validateAdapter(adapter);

    const newRoutes = buildRoutes(
      collect(adapter, 'routes'),
      collect(adapter, 'configs'),
      collect(adapter, 'middlewares'),
    );

    if (newRoutes.length === 0) return newRoutes;

    newRoutes.forEach(route => tagRoutes(route, adapter));

    for (const newRoute of newRoutes) {
      const existing = this.routes.find(r => r.path === newRoute.path);

      if (
        existing &&
        Array.isArray(newRoute.children) &&
        newRoute.children.length > 0
      ) {
        existing.children = existing.children || [];
        for (const child of newRoute.children) {
          existing.children.push(child);
        }
        newRoute.children.forEach(child => linkParents(child, existing));
      } else if (existing) {
        continue;
      } else {
        this.routes.push(newRoute);
        validateConfig([newRoute]);
        linkParents(newRoute);
      }
    }

    clearMatchCache();
    return newRoutes;
  }

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
      clearMatchCache();
    }

    return removed;
  }

  /**
   * Returns an Express middleware that handles incoming requests.
   * Matches the URL path to the compiled route tree, populating req.params,
   * then calls the action chain.
   */
  expressMiddleware(req, res, next) {
    // Determine path relative to router's base URL (e.g. req.path in Express
    // is already trimmed of app mounting points depending on how it's mounted,
    // but typically for API router we take req.path)
    let pathname = req.path;

    // Provide a mocked application context equivalent to 'ctx' for hooks
    const ctx = {
      app: req.app,
      req,
      res,
      pathname,
      _instance: this,
      [ROUTE_MOUNT_KEY]: new Set(),
      [ROUTE_UNMOUNT_KEY]: new Set(),
    };

    const matcher = createMatcher(
      { children: this.routes },
      this.baseUrl,
      {
        decode: decodeUrl,
        ...this.options,
      },
      pathname,
    );

    // Recursively resolve matching route (similar to SSR mechanism)
    const state = {
      matches: matcher.next(),
      cachedMatch: null,
      current: null,
    };

    const resolveNext = async (resume = false, parent = null) => {
      if (
        resume &&
        state.matches &&
        state.matches.value &&
        !state.matches.done
      ) {
        parent = state.matches.value.route;
      }

      state.matches = state.cachedMatch || matcher.next();
      state.cachedMatch = null;

      if (!resume) {
        if (
          state.matches.done ||
          (parent && !isDescendant(parent, state.matches.value.route))
        ) {
          state.cachedMatch = state.matches;
          return null; // Signals failure to match at this current depth
        }
      }

      if (state.matches.done) {
        return false; // No more routes to try
      }

      state.current = { ...ctx, ...state.matches.value };

      // Inject matched params onto req.params instead of ctx
      Object.assign(req.params, state.current.params || {});

      try {
        await runInit(state.current.route, state.current);
        await runMount(state.current.route, state.current);

        // Let the action (composed middlewares + export) take over
        // Action is responsible for calling next() if it doesn't terminate request
        const actionResult = await state.current.route.action(req, res, err => {
          if (err) throw err;
          // If action calls next() with no err, it means it didn't fulfill the response.
          // In API routing, we must continue trying to match sibling/child routes or give up.
          return resolveNext(true, parent);
        });

        return actionResult;
      } catch (err) {
        return next(err);
      }
    };

    return resolveNext()
      .then(handled => {
        if (handled === false || handled === null) {
          // No route handled the request fully
          next();
        }
      })
      .catch(next);
  }
}

export default ApiRouter;
