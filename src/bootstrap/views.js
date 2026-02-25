/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Router from '../shared/renderer/router';
import { getAppName, getAppDescription } from '../shared/renderer/redux';
import { createContextAdapter } from '../shared/context';

// Discover view lifecycle modules from apps directory
const viewsLifecycleContext = require.context(
  '../apps',
  true,
  /^\.\/[^/]+\/views\/index\.[cm]?[jt]s$/i,
);

// =============================================================================
// LOGGING
// =============================================================================

const TAG = 'Views';

/**
 * Log a bootstrap message.
 *
 * @param {string} message - Message text
 * @param {'info'|'warn'|'error'} [level='info'] - Log level
 */
function log(message, level = 'info') {
  const prefix = `[${TAG}]`;
  switch (level) {
    case 'error':
      console.error(`${prefix} ❌ ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} ⚠️ ${message}`);
      break;
    default:
      console.info(`${prefix} ✅ ${message}`);
  }
}

// =============================================================================
// VIEW MODULE DISCOVERY
// =============================================================================

/** Pattern to match view lifecycle files: ./moduleName/views/index.js */
const LIFECYCLE_PATTERN = /^\.\/([^/]+)\/views\/index\.[cm]?[jt]s$/i;

/**
 * Discover view modules and collect their view contexts.
 *
 * Scans apps for views/index.js lifecycle files, calls hooks.views()
 * on each, and returns the collected context adapters.
 *
 * @returns {Map<string, object>} Map of module name → context adapter
 */
function discoverViewModules() {
  const adapters = new Map();
  const lifecycleAdapter = createContextAdapter(viewsLifecycleContext);

  for (const filePath of lifecycleAdapter.files()) {
    const match = filePath.match(LIFECYCLE_PATTERN);
    if (!match) continue;

    const moduleName = match[1];

    try {
      const hooks = lifecycleAdapter.load(filePath);

      if (hooks && typeof hooks.views === 'function') {
        const viewContext = hooks.views();
        if (viewContext) {
          adapters.set(moduleName, createContextAdapter(viewContext));
        }
      } else {
        log(`[${moduleName}] No views() hook found, skipping`, 'warn');
      }
    } catch (error) {
      log(`[${moduleName}] Failed to load views: ${error.message}`, 'error');
    }
  }

  log(`${adapters.size} view module(s) discovered`);
  return adapters;
}

// =============================================================================
// APP ROUTER
// =============================================================================

/**
 * AppRouter extends the base Router to add custom metadata handling
 */
class AppRouter extends Router {
  /**
   * Resolves a route and updates metadata (title, description)
   * @param {Object} context - Router context
   * @returns {Promise<Object>} Resolved page with metadata
   */
  async resolve(context) {
    const page = await super.resolve(context);
    const state = context.store.getState();
    const appName = getAppName(state);
    const appDescription = getAppDescription(state);

    if (page) {
      // 1. Handle Metadata Fallback (Description)
      if (!page.description) {
        page.description = appDescription;
      }

      // 2. Handle Title Suffixing (App Name)
      if (page.title) {
        // If page has a specific title, append app name: "Leaf Title - App Name"
        page.title = `${page.title} - ${appName}`;
      } else {
        // If no title, fallback to app name: "App Name"
        page.title = appName;
      }
    }

    return page;
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Creates the router by discovering per-module view contexts.
 *
 * @param {Object} options - Router initialization options
 * @param {Object} options.pluginManager - Plugin manager instance (client or server)
 * @returns {Promise<Router>} Configured router instance
 */
export default async function initializeRouter({ pluginManager } = {}) {
  // Discover per-module view adapters
  const viewAdapters = discoverViewModules();

  // Build router from the first adapter, then merge the rest
  let router = null;

  for (const [name, adapter] of viewAdapters) {
    try {
      if (!router) {
        router = new AppRouter(adapter, {
          context: {
            pluginManager,
          },
          errorHandler(error, ctx) {
            if (__DEV__ && error.status !== 403) {
              console.error('Router Error:', error);
              throw error;
            }

            const { _instance, ...context } = ctx;
            return _instance.resolve({
              ...context,
              pathname: '/error',
              error,
            });
          },
          async onRouteInit(route, ctx) {
            const ns =
              route.workspace || (route.module && route.module.workspace);
            const manager = ctx.pluginManager || pluginManager;

            if (ns && manager) {
              if (!manager.isNamespaceLoaded(ns)) {
                if (__DEV__) {
                  console.log(`[Router] Loading plugin namespace: ${ns}`);
                }
                await manager.loadNamespace(ns);
              } else if (__DEV__) {
                console.log(`[Router] Plugin namespace already loaded: ${ns}`);
              }
            }
          },
          async onRouteDestroy(route, ctx) {
            const ns =
              route.workspace || (route.module && route.module.workspace);
            const manager = ctx.pluginManager || pluginManager;

            if (ns && manager) {
              if (__DEV__) {
                console.log(`[Router] Unloading plugin namespace: ${ns}`);
              }
              await manager.unloadNamespace(ns);
            }
          },
        });
      } else {
        router.add(adapter);
      }
    } catch (error) {
      log(`[${name}] Failed to add routes: ${error.message}`, 'error');
    }
  }

  if (!router) {
    throw new Error('No view modules found — cannot initialize router');
  }

  // Append catch-all route for 404s
  router.routes.push({
    path: '/*path',
    action: context => router.resolve({ ...context, pathname: '/not-found' }),
  });

  log('Router initialized');
  return router;
}
