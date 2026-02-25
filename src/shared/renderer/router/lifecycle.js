/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  ROUTE_INIT_KEY,
  ROUTE_MOUNT_KEY,
  ROUTE_UNMOUNT_KEY,
} from './constants';
import { log } from './utils';
import { composeMiddleware } from './composer';

/**
 * Creates init function for config and route initialization
 * Config init runs once per config (globally)
 * Route init runs once per route, sequential parent → child
 */
export function createInit(configs, init) {
  // Get configs that have init functions
  const initableConfigs = configs.filter(
    c => typeof c.module.init === 'function',
  );

  if (initableConfigs.length === 0 && typeof init !== 'function') {
    return undefined;
  }

  return async function (ctx) {
    // 1. Init configs first (once per config, tracked by module)
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

    // 2. Init route (original behavior)
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
 * Creates a combined mount function that runs config mounts first, then route mount
 * Config mounts are tracked per-navigation to avoid duplicates in nested routes
 */
export function createMount(configs, routeMount) {
  // Get configs that have mount functions
  const mountableConfigs = configs.filter(
    c => typeof c.module.mount === 'function',
  );

  // Return combined function if needed
  return async function (ctx) {
    // Initialize per-navigation mount tracking if not exists
    if (!ctx[ROUTE_MOUNT_KEY]) {
      ctx[ROUTE_MOUNT_KEY] = new Set();
    }

    // Mount configs first (once per navigation, tracked by module)
    for (const config of mountableConfigs) {
      try {
        // Skip if this config module already mounted during this navigation
        if (ctx[ROUTE_MOUNT_KEY].has(config.module)) {
          continue;
        }
        ctx[ROUTE_MOUNT_KEY].add(config.module);
        await config.module.mount(ctx);
      } catch (error) {
        log(`Config mount error: ${error.message}`, 'error');
      }
    }

    // Route mount always runs (it's specific to this route)
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
 * Creates a combined unmount function for cleanup when leaving a route
 * Route unmount runs first, then config unmounts
 */
export function createUnmount(configs, routeUnmount) {
  // Get configs that have unmount functions
  const unmountableConfigs = configs.filter(
    c => typeof c.module.unmount === 'function',
  );

  if (unmountableConfigs.length === 0 && typeof routeUnmount !== 'function') {
    return undefined;
  }

  return async function (ctx) {
    if (!ctx[ROUTE_UNMOUNT_KEY]) {
      ctx[ROUTE_UNMOUNT_KEY] = new Set();
    }

    // 1. Route unmount first (specific to this route)
    if (typeof routeUnmount === 'function') {
      try {
        await routeUnmount(ctx);
      } catch (error) {
        log(`Route unmount error: ${error.message}`, 'error');
      }
    }

    // 2. Config unmounts (in order)
    for (const config of unmountableConfigs) {
      // Skip if this config module already unmounted during this pass
      if (ctx[ROUTE_UNMOUNT_KEY].has(config.module)) {
        continue;
      }
      ctx[ROUTE_UNMOUNT_KEY].add(config.module);

      try {
        await config.module.unmount(ctx);
      } catch (error) {
        log(`Config unmount error: ${error.message}`, 'error');
      }
    }
  };
}

/**
 * Creates a middleware runner for the route
 * Combines config middlewares and route middleware into a single composed function
 */
export function createMiddlewareRunner(configs, routeMiddleware) {
  const middlewares = [];

  // 1. Add config middlewares
  for (const config of configs) {
    if (typeof config.module.middleware === 'function') {
      middlewares.push(config.module.middleware);
    }
  }

  // 2. Add route middleware
  if (typeof routeMiddleware === 'function') {
    middlewares.push(routeMiddleware);
  }

  // Return composed function
  return composeMiddleware(middlewares);
}

/**
 * Creates the action function for a route
 * Handles: middleware (replaces guards), data loading (getInitialProps), and component rendering
 * NOTE: init/mount are handled separately via runInit/runMount in resolve()
 */
export function createAction(pageInfo, configs = [], layouts = []) {
  // Pre-extract at build time
  const { module } = pageInfo;
  const runMiddleware = createMiddlewareRunner(configs, module.middleware);
  const reversedLayouts = [...layouts].reverse(); // Cache reversed order

  return function (context) {
    // Run middleware stack, with core logic as the final "next"
    return runMiddleware(context, async ctx => {
      // 1. Load route data (per-request)
      let initialProps = {};
      if (typeof module.getInitialProps === 'function') {
        try {
          initialProps = await module.getInitialProps(ctx);
        } catch (error) {
          log(`Error loading ${pageInfo.path}: ${error.message}`, 'error');
        }
      }
      Object.defineProperty(ctx, 'initialProps', {
        value: initialProps,
        writable: false,
        enumerable: true,
        configurable: false,
      });

      // 2. Get component
      const Page$ = module.default;
      if (!Page$) {
        log(`No component for ${pageInfo.path}`, 'error');
        return null;
      }

      // 3. Build component tree with layouts (innermost to outermost)
      // metadata is now just the initialProps
      const metadata = initialProps || {};

      let component = <Page$ context={ctx} {...initialProps} />;
      for (const layout of reversedLayouts) {
        const Layout$ = layout.module.default || layout.module;
        if (Layout$) {
          component = (
            <Layout$ context={ctx} metadata={metadata}>
              {component}
            </Layout$>
          );
        }
      }

      return { ...metadata, component };
    });
  };
}

/**
 * Runs init hooks sequentially from parent to child route
 */
export async function runInit(route, ctx) {
  if (!route) return;

  // Get route hierarchy from root to current (parent → child)
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

  // Init each route in sequence (parent → child)
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

/**
 * Runs the route's mount hook and returns the result.
 */
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

/**
 * Runs the route's unmount hook for cleanup.
 * Traverses up the route hierarchy (child -> parent) to unmount everything.
 */
export async function runUnmount(route, ctx) {
  let current = route;
  while (current) {
    if (typeof current.unmount === 'function') {
      try {
        await current.unmount(ctx);
      } catch (error) {
        log(`Unmount error for "${current.path}": ${error.message}`, 'error');
      }
    }

    // Auto-uninstall plugins via router options callback
    if (
      // eslint-disable-next-line no-underscore-dangle
      ctx._instance &&
      // eslint-disable-next-line no-underscore-dangle
      ctx._instance.options &&
      // eslint-disable-next-line no-underscore-dangle
      typeof ctx._instance.options.onRouteUnmount === 'function'
    ) {
      try {
        // eslint-disable-next-line no-underscore-dangle
        await ctx._instance.options.onRouteUnmount(current, ctx);
      } catch (error) {
        log(
          `onRouteUnmount error for "${current.path}": ${error.message}`,
          'error',
        );
      }
    }

    current = current.parent;
  }
}
