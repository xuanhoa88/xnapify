/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { discoverModules } from '@shared/renderer/autoloader';
import { getAppName, getAppDescription } from '@shared/renderer/redux';
import Router from '@shared/renderer/router';

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
 * @param {Object} options.extension - Extension manager instance (client or server)
 * @param {Object} options.container - DI container instance (client or server)
 * @returns {Promise<Router>} Configured router instance
 */
export default async function initializeRouter(options = {}) {
  // ─── Initialize ─────────────────────────────────────────────────────
  const { extension, container, store } = options;

  // Discover modules and run lifecycle phases (translations → providers → views)
  const { mergedAdapter } = await discoverModules(viewsLifecycleContext, {
    container,
    store,
  });

  if (!mergedAdapter) {
    const err = new Error('No view modules found — cannot initialize router');
    err.name = 'NoViewModulesError';
    err.status = 500;
    throw err;
  }

  const router = new AppRouter(mergedAdapter, {
    context: {
      extension,
      container,
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
        route.workspace ||
        (route.module && route.module.workspace) ||
        route.moduleName ||
        route.path;
      const manager = ctx.extension || extension;

      if (ns && manager) {
        if (!manager.isNamespaceActive(ns)) {
          if (__DEV__) {
            console.log(`[Router] Loading extension namespace: ${ns}`);
          }
          await manager.activateNamespace(ns);
        } else if (__DEV__) {
          console.log(`[Router] Extension namespace already loaded: ${ns}`);
        }
      }
    },
    async onRouteDestroy(route, ctx) {
      const ns =
        route.workspace ||
        (route.module && route.module.workspace) ||
        route.moduleName ||
        route.path;
      const manager = ctx.extension || extension;

      if (ns && manager) {
        if (__DEV__) {
          console.log(`[Router] Unloading extension namespace: ${ns}`);
        }
        await manager.deactivateNamespace(ns);
      }
    },
  });

  // Register on container so extensions can inject view routes via router.add()
  container.instance('viewRouter', router);

  // Flush any extension view routes that were buffered during init
  // (extensions load before the router is created; also re-injects on
  // subsequent SSR requests where a new router is created)
  if (extension && typeof extension.flushPendingRoutes === 'function') {
    extension.flushPendingRoutes(router);
  }

  // Append catch-all route for 404s
  router.routes.push({
    path: '/*path',
    action: context => router.resolve({ ...context, pathname: '/not-found' }),
  });

  log('Router initialized');
  return router;
}
