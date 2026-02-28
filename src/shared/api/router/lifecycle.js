/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import merge from 'lodash/merge';
import { composeMiddleware } from '../../utils/composer';
import { addNamespace } from '../../i18n/utils';
import { getTranslations } from '../../i18n/loader';
import {
  ROUTE_INIT_KEY,
  ROUTE_MOUNT_KEY,
  ROUTE_TRANSLATIONS_KEY,
} from './constants';
import { log, normalizeError } from './utils';

/**
 * Creates init function for config and route initialization
 */
export function createInit(configs, init) {
  const initableConfigs = configs.filter(
    c => typeof c.module.init === 'function',
  );

  if (initableConfigs.length === 0 && typeof init !== 'function') {
    return undefined;
  }

  return async function (ctx) {
    for (const config of initableConfigs) {
      try {
        if (!config.module[ROUTE_INIT_KEY]) {
          await config.module.init(ctx);
          config.module[ROUTE_INIT_KEY] = true;
        }
      } catch (error) {
        log(`Config init error: ${error.message}`, 'error');
      }
    }

    if (typeof init === 'function') {
      try {
        await init(ctx);
      } catch (error) {
        log(`Route init error: ${error.message}`, 'error');
      }
    }
  };
}

/**
 * Creates a combined mount function
 */
export function createMount(configs, routeMount) {
  const mountableConfigs = configs.filter(
    c => typeof c.module.mount === 'function',
  );

  return async function (ctx) {
    if (!ctx[ROUTE_MOUNT_KEY]) {
      ctx[ROUTE_MOUNT_KEY] = new Set();
    }

    for (const config of mountableConfigs) {
      try {
        if (ctx[ROUTE_MOUNT_KEY].has(config.module)) {
          continue;
        }
        ctx[ROUTE_MOUNT_KEY].add(config.module);
        await config.module.mount(ctx);
      } catch (error) {
        log(`Config mount error: ${error.message}`, 'error');
      }
    }

    if (typeof routeMount === 'function') {
      try {
        await routeMount(ctx);
      } catch (error) {
        log(`Route mount error: ${error.message}`, 'error');
      }
    }
  };
}

/**
 * Creates a translations registration function for the route.
 * Merges translations from configs and route-level `translations()` export,
 * then registers them via addNamespace using the route path as the namespace.
 *
 * @param {Object[]} configs - Matched config modules
 * @param {Function|undefined} routeTranslations - Route module's translations export
 * @param {string} routePath - The route pathname (used as i18n namespace fallback)
 * @param {string} moduleName - The module name to use as i18n namespace
 * @returns {Function|undefined} Registration function or undefined
 */
export function createTranslations(
  configs,
  routeTranslations,
  routePath,
  moduleName,
) {
  const translatableConfigs = configs.filter(
    c => typeof c.module.translations === 'function',
  );

  if (
    translatableConfigs.length === 0 &&
    typeof routeTranslations !== 'function'
  ) {
    return undefined;
  }

  return function () {
    const merged = {};

    // 1. Collect config translations first
    for (const config of translatableConfigs) {
      try {
        const result = getTranslations(config.module.translations());
        if (result && typeof result === 'object') {
          Object.entries(result).forEach(([locale, messages]) => {
            merged[locale] = merge({}, merged[locale], messages);
          });
        }
      } catch (error) {
        log(`Config translations error: ${error.message}`, 'error');
      }
    }

    // 2. Route translations override/merge on top
    if (typeof routeTranslations === 'function') {
      try {
        const result = getTranslations(routeTranslations());
        if (result && typeof result === 'object') {
          Object.entries(result).forEach(([locale, messages]) => {
            merged[locale] = merge({}, merged[locale], messages);
          });
        }
      } catch (error) {
        log(`Route translations error: ${error.message}`, 'error');
      }
    }

    // 3. Register with i18n
    try {
      if (Object.keys(merged).length > 0) {
        const namespace = (moduleName || '').replace(/[()]/g, '') || routePath;
        addNamespace(namespace, merged);
      }
    } catch (error) {
      log(`addNamespace error for "${routePath}": ${error.message}`, 'error');
    }
  };
}

/**
 * Runs translation registration for a route hierarchy (parent → child).
 * Each route's translations are registered once (tracked via ROUTE_TRANSLATIONS_KEY).
 */
export async function runTranslations(route, _ctx) {
  if (!route) return;

  const hierarchy = [];
  let current = route;
  while (current) {
    hierarchy.unshift(current);
    current = current.parent;
  }

  for (const r of hierarchy) {
    if (typeof r.translations === 'function' && !r[ROUTE_TRANSLATIONS_KEY]) {
      try {
        r.translations();
        r[ROUTE_TRANSLATIONS_KEY] = true;
      } catch (error) {
        log(`Translations error for "${r.path}": ${error.message}`, 'error');
      }
    }
  }
}
/**
 * Creates a middleware runner for the route
 */
export function createMiddlewareRunner(configs, routeMiddlewares) {
  const middlewares = [];

  // Add config middlewares
  for (const config of configs) {
    if (typeof config.module.middleware === 'function') {
      middlewares.push(config.module.middleware);
    } else if (Array.isArray(config.module.middleware)) {
      middlewares.push(...config.module.middleware);
    }
  }

  // Add route middlewares (e.g. from _middleware.js)
  for (const mw of routeMiddlewares) {
    const handler = mw.module.default || mw.module;
    if (typeof handler === 'function') {
      middlewares.push(handler);
    } else if (Array.isArray(handler)) {
      middlewares.push(...handler);
    }
  }

  return composeMiddleware(...middlewares);
}

/**
 * Creates the action function for an API route
 */
export function createAction(pageInfo, configs = [], middlewares = []) {
  const { module } = pageInfo;

  // Generic/inherited route middleware chain + Custom route parsers
  const baseMiddleware = createMiddlewareRunner(configs, middlewares);

  return function (req, res, next) {
    // Determine the active method
    const method = req.method.toLowerCase(); // 'get', 'post', 'put', 'patch', 'delete'

    // Check if module exports a handler for this method directly
    let handlerExport = module[method] || module[method.toUpperCase()];

    // Fallback to default export if direct method not found
    if (handlerExport === undefined && module.default !== undefined) {
      handlerExport = module.default;
    }
    // If module is a function (CommonJS export =)
    if (handlerExport === undefined && typeof module === 'function') {
      handlerExport = module;
    }

    if (handlerExport === undefined) {
      // Log explicitly about missing method handler
      log(`No handler found for ${req.method} ${req.path}`, 'warn');
      return next(); // Not treated as error, let Express 404 handler catch it
    }

    let routeMiddlewares = [];
    let handler;

    if (Array.isArray(handlerExport)) {
      if (handlerExport.length === 0) {
        log(`No handler found for ${req.method} ${req.path}`, 'warn');
        return next();
      }
      // The last item in the array is the route handler, preceding items are middlewares
      handler = handlerExport[handlerExport.length - 1];
      routeMiddlewares = handlerExport.slice(0, -1);
    } else {
      handler = handlerExport;
    }

    if (typeof handler !== 'function') {
      log(`No handler found for ${req.method} ${req.path}`, 'warn');
      return next();
    }

    // Compile the final action pipeline for this specific incoming method!
    const runMethodPipeline =
      routeMiddlewares.length > 0
        ? composeMiddleware(baseMiddleware, ...routeMiddlewares)
        : baseMiddleware;

    return runMethodPipeline(req, res, err => {
      // If error from middleware, pass to next error handler
      if (err) return next(normalizeError(err));

      // Execute route handler
      try {
        const result = handler(req, res, next);

        // If handler returns a Promise, catch errors and delegate to Express
        if (result && typeof result.then === 'function') {
          return result.catch(asyncErr => {
            next(normalizeError(asyncErr));
          });
        }

        return Promise.resolve(result);
      } catch (handlerErr) {
        next(normalizeError(handlerErr));
      }
    });
  };
}

export async function runInit(route, ctx) {
  if (!route) return;

  const hierarchy = [];
  let current = route;
  while (current) {
    hierarchy.unshift(current);
    current = current.parent;
  }

  if (
    // eslint-disable-next-line no-underscore-dangle
    ctx._instance &&
    // eslint-disable-next-line no-underscore-dangle
    ctx._instance.options &&
    // eslint-disable-next-line no-underscore-dangle
    typeof ctx._instance.options.onRouteInit === 'function'
  ) {
    try {
      // eslint-disable-next-line no-underscore-dangle
      await ctx._instance.options.onRouteInit(route, ctx);
    } catch (error) {
      log(`onRouteInit error for "${route.path}": ${error.message}`, 'error');
    }
  }

  for (const r of hierarchy) {
    if (typeof r.init === 'function' && !r[ROUTE_INIT_KEY]) {
      try {
        await r.init(ctx);
        r[ROUTE_INIT_KEY] = true;
      } catch (error) {
        log(`Init error for "${r.path}": ${error.message}`, 'error');
      }
    }
  }
}

export async function runMount(route, ctx) {
  if (!route) return null;

  if (
    // eslint-disable-next-line no-underscore-dangle
    ctx._instance &&
    // eslint-disable-next-line no-underscore-dangle
    ctx._instance.options &&
    // eslint-disable-next-line no-underscore-dangle
    typeof ctx._instance.options.onRouteMount === 'function'
  ) {
    try {
      // eslint-disable-next-line no-underscore-dangle
      await ctx._instance.options.onRouteMount(route, ctx);
    } catch (error) {
      log(`onRouteMount error for "${route.path}": ${error.message}`, 'error');
    }
  }

  if (typeof route.mount !== 'function') return null;
  try {
    return await route.mount(ctx);
  } catch (error) {
    log(`Mount error for "${route.path}": ${error.message}`, 'error');
    return null;
  }
}
