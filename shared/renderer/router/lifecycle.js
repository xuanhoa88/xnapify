/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { getTranslations } from '@shared/i18n/loader';
import { addNamespace } from '@shared/i18n/utils';
import { composeMiddleware } from '@shared/utils/middleware';

import {
  ROUTE_INIT_KEY,
  ROUTE_MOUNT_KEY,
  ROUTE_UNMOUNT_KEY,
  ROUTE_TRANSLATIONS_KEY,
} from './constants';
import { log } from './utils';

// =============================================================================
// HELPERS
// =============================================================================

/** @type {symbol} Cached hierarchy key — avoids re-walking .parent pointers */
const ROUTE_HIERARCHY_KEY = Symbol('__xnapify.route.hierarchy__');

/**
 * Returns the parent→child hierarchy for a route.
 * Result is cached on the route object via symbol key to avoid
 * repeated O(n²) unshift traversals on every navigation.
 *
 * @param {Object} route - Leaf route node
 * @returns {Object[]} Array from root to leaf
 */
function getHierarchy(route) {
  if (route[ROUTE_HIERARCHY_KEY]) return route[ROUTE_HIERARCHY_KEY];

  const hierarchy = [];
  let current = route;
  while (current) {
    hierarchy.push(current); // O(1) push instead of O(n) unshift
    current = current.parent;
  }
  hierarchy.reverse(); // single O(n) reverse

  route[ROUTE_HIERARCHY_KEY] = hierarchy;
  return hierarchy;
}

/**
 * Extracts the router options from the context.
 * Avoids repeated `ctx._instance && ctx._instance.options` property chains.
 *
 * @param {Object} ctx - Route context
 * @returns {Object|null} Router options or null
 * @private
 */
function getRouterOptions(ctx) {
  // eslint-disable-next-line no-underscore-dangle
  return (ctx._instance && ctx._instance.options) || null;
}

// =============================================================================
// LIFECYCLE FACTORIES — called once at build time, closures returned
// =============================================================================

/**
 * Creates init function for config and route initialization
 * Config init runs once per config (globally)
 * Route init runs once per route, sequential parent → child
 */
export function createInit(configs, init) {
  // Get configs that have init functions
  const initConfigs = configs.filter(c => typeof c.module.init === 'function');

  if (initConfigs.length === 0 && typeof init !== 'function') {
    return undefined;
  }

  return async function (ctx) {
    // 1. Init configs sequentially (order-dependent, avoids microtask overhead)
    for (const config of initConfigs) {
      if (!config.module[ROUTE_INIT_KEY]) {
        try {
          await config.module.init(ctx);
          config.module[ROUTE_INIT_KEY] = true;
        } catch (error) {
          log(`Config init error: ${error.message}`, 'error');
        }
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

  // Early return when nothing to do (matches createInit/createUnmount pattern)
  if (mountableConfigs.length === 0 && typeof routeMount !== 'function') {
    return undefined;
  }

  // Return combined function if needed
  return async function (ctx) {
    // Initialize per-navigation mount tracking if not exists
    if (!ctx[ROUTE_MOUNT_KEY]) {
      ctx[ROUTE_MOUNT_KEY] = new Set();
    }

    // Mount configs sequentially (avoids microtask overhead)
    for (const config of mountableConfigs) {
      // Skip if this config module already mounted during this navigation
      if (ctx[ROUTE_MOUNT_KEY].has(config.module)) {
        continue;
      }
      ctx[ROUTE_MOUNT_KEY].add(config.module);
      try {
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

    // 2. Config unmounts sequentially (avoids microtask overhead)
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
 * Creates a translations registration function for the route.
 * Merges translations from configs and route-level `translations()` export,
 * then registers them via addNamespace using the route path as the namespace.
 *
 * Uses shallow spread instead of lodash/merge since i18n message objects
 * are flat per locale (no nested keys to deep-clone).
 *
 * @param {Object[]} configs - Matched config modules
 * @param {Function|undefined} routeTranslations - Route module's translations export
 * @param {string} routePath - The route pathname (used as i18n namespace fallback)
 * @param {string} moduleName - The module name to use as i18n namespace
 * @returns {Function|undefined} Registration function or undefined
 */
export function buildTranslationsLoader(
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

  return function (inheritedTranslations = {}) {
    // Shallow clone to avoid mutating parent (no deep-clone needed)
    const merged = {};
    const inheritedKeys = Object.keys(inheritedTranslations);
    for (let i = 0; i < inheritedKeys.length; i++) {
      const key = inheritedKeys[i];
      merged[key] = { ...inheritedTranslations[key] };
    }

    // 1. Collect config translations first
    for (const config of translatableConfigs) {
      try {
        const translations = getTranslations(config.module.translations());
        if (translations && typeof translations === 'object') {
          const locales = Object.keys(translations);
          for (let i = 0; i < locales.length; i++) {
            const locale = locales[i];
            merged[locale] = { ...merged[locale], ...translations[locale] };
          }
        }
      } catch (error) {
        log(`Config translations error: ${error.message}`, 'error');
      }
    }

    // 2. Route translations override/merge on top
    if (typeof routeTranslations === 'function') {
      try {
        const translations = getTranslations(routeTranslations());
        if (translations && typeof translations === 'object') {
          const locales = Object.keys(translations);
          for (let i = 0; i < locales.length; i++) {
            const locale = locales[i];
            merged[locale] = { ...merged[locale], ...translations[locale] };
          }
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

    // Return merged translations so they can be passed to the next child
    return merged;
  };
}

/**
 * Runs translation registration for a route hierarchy (parent → child).
 * Each route's translations are registered once (tracked via ROUTE_TRANSLATIONS_KEY).
 * Uses cached hierarchy to avoid redundant .parent walks.
 */
export async function loadRouteTranslations(route, _ctx) {
  if (!route) return;

  const hierarchy = getHierarchy(route);

  // Track the accumulated translations as we move down the tree
  let accumulatedTranslations = {};

  for (const r of hierarchy) {
    if (typeof r.translations === 'function') {
      try {
        if (!r[ROUTE_TRANSLATIONS_KEY]) {
          accumulatedTranslations =
            r.translations(accumulatedTranslations) || accumulatedTranslations;
          r[ROUTE_TRANSLATIONS_KEY] = accumulatedTranslations;
        } else {
          accumulatedTranslations = r[ROUTE_TRANSLATIONS_KEY];
        }
      } catch (error) {
        log(`Translations error for "${r.path}": ${error.message}`, 'error');
      }
    }
  }
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
  return composeMiddleware(...middlewares);
}

/**
 * Creates the action function for a route
 * Handles: middleware (replaces guards), data loading (getInitialProps), and component rendering
 * NOTE: init/mount are handled separately via runInit/runMount in resolve()
 */
export function createAction(pageInfo, configs = [], layouts = []) {
  const { module } = pageInfo;
  const runMiddleware = createMiddlewareRunner(configs, module.middleware);
  const reversedLayouts = [...layouts].reverse();

  return function (context) {
    return runMiddleware(context, async err => {
      // composeMiddleware calls next(err) when a middleware throws.
      // Re-throw so the error propagates to the router's errorHandler.
      if (err) throw err;

      // 1. Load route data
      let pageData = {};
      if (typeof module.getInitialProps === 'function') {
        try {
          pageData = await module.getInitialProps(context);
        } catch (error) {
          log(`Error loading ${pageInfo.path}: ${error.message}`, 'error');
        }
      }

      Object.defineProperty(context, 'initialProps', {
        value: pageData,
        writable: false, // can't reassign context.initialProps = something
        enumerable: true, // shows up in Object.keys / spreads
        configurable: true, // allows redefine on re-navigation, fixes the crash
      });

      // 2. Get component
      const Page = module.default;
      if (!Page) {
        log(`No component for ${pageInfo.path}`, 'error');
        return null;
      }

      // 3. Build component tree with layouts (innermost to outermost)
      let component = <Page context={context} />;
      for (const layout of reversedLayouts) {
        const Layout = layout.module.default || layout.module;
        if (Layout) {
          component = <Layout context={context}>{component}</Layout>;
        }
      }

      return { ...pageData, component };
    });
  };
}

// =============================================================================
// RUNTIME LIFECYCLE — called during navigation
// =============================================================================

/**
 * Runs init hooks sequentially from parent to child route.
 * Uses cached hierarchy to avoid redundant .parent walks.
 */
export async function runInit(route, ctx) {
  if (!route) return;

  // Use cached hierarchy (shared with loadRouteTranslations)
  const hierarchy = getHierarchy(route);

  const options = getRouterOptions(ctx);
  if (options && typeof options.onRouteInit === 'function') {
    try {
      await options.onRouteInit(route, ctx);
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

  const options = getRouterOptions(ctx);
  if (options && typeof options.onRouteMount === 'function') {
    try {
      await options.onRouteMount(route, ctx);
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
  const options = getRouterOptions(ctx);

  let current = route;
  while (current) {
    if (typeof current.unmount === 'function') {
      try {
        await current.unmount(ctx);
      } catch (error) {
        log(`Unmount error for "${current.path}": ${error.message}`, 'error');
      }
    }

    // Auto-uninstall extensions via router options callback
    if (options && typeof options.onRouteUnmount === 'function') {
      try {
        await options.onRouteUnmount(current, ctx);
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
