/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  discoverViewModules,
  bootViewModules,
  resetDiscoveryCache,
} from '@shared/renderer/autoloader.js';
import { features } from '@shared/renderer/redux/index.js';
import Router from '@shared/renderer/router/index.js';
const { getAppName, getAppDescription } = features;

// Discover view lifecycle modules from apps directory
const viewsContext = import.meta.webpackContext('../apps', {
  recursive: true,
  regExp: /^\.\/[^/]+\/views\/index\.[cm]?[jt]s$/i,
});

const IS_SERVER = typeof window === 'undefined';

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
    if (!page) return page;
    const state = context.store.getState();

    // 1. Handle Metadata Fallback (Description)
    if (!page.description) {
      page.description = getAppDescription(state);
    }

    // 2. Handle Title Suffixing (App Name)
    const appName = getAppName(state);
    if (page.title) {
      const title = String(page.title).trim();
      if (!title) {
        // Fallback if the title was only whitespace
        page.title = appName;
      } else if (title !== appName) {
        // Guard against multiple common separators to avoid duplication
        const hasSuffix =
          title.endsWith(` - ${appName}`) ||
          title.endsWith(` | ${appName}`) ||
          title.endsWith(` · ${appName}`);
        page.title = hasSuffix ? title : `${title} - ${appName}`;
      } else {
        // Title exactly matches app name
        page.title = title;
      }
    } else {
      page.title = appName;
    }
    return page;
  }
}

// =============================================================================
// ROUTER OPTIONS
// =============================================================================

/**
 * Router options shared by every AppRouter instance.
 *
 * @param {Object} extension - Extension manager instance
 * @returns {Object} Router options
 */
function createRouterOptions(extension) {
  return {
    errorHandler(error, ctx) {
      if (__DEV__ && error.status !== 403) {
        console.error('Router Error:', error);
        throw error;
      }
      const { _instance, ...context } = ctx;
      return _instance.resolve({
        ...context,
        error,
        pathname: '/error',
      });
    },
    async onRouteInit(route) {
      try {
        const ns = (route.module && route.module.namespace) || route.path;
        if (ns) {
          if (__DEV__) {
            console.log(`[Router] Loading extension namespace: ${ns}`);
          }
          await extension.ensureViewNamespaceActive(ns);
        }
      } catch (err) {
        log('Failed to load extension namespace: ' + err, 'error');
      }
    },
    async onRouteDestroy(route) {
      try {
        const ns = (route.module && route.module.namespace) || route.path;
        if (ns) {
          if (__DEV__) {
            console.log(`[Router] Unloading extension namespace: ${ns}`);
          }
          await extension.deactivateViewNamespace(ns);
        }
      } catch (err) {
        log('Failed to unload extension namespace: ' + err, 'error');
      }
    },
  };
}

/**
 * Catch-all route appended after every other route so unknown paths render
 * the not-found page. Resolves through the router instance that matched it
 * (`ctx._instance`), never through a captured instance, because on the
 * server the tree is shared by many Router instances.
 *
 * @param {Router} fallback - Router used when the context carries no instance
 * @returns {Object} Route definition
 */
function createCatchAllRoute(fallback) {
  return {
    path: '/:path*',
    action: context =>
      // eslint-disable-next-line no-underscore-dangle
      (context._instance || fallback).resolve({
        ...context,
        pathname: '/not-found',
      }),
  };
}

// =============================================================================
// SERVER: COMPILE ONCE, INSTANTIATE PER REQUEST
// =============================================================================

/**
 * Process-wide compiled route tree (server only).
 *
 * Building the tree means loading every route module, merging layouts,
 * injecting extension routes and registering translations. None of that
 * depends on the request, so it is done once and shared. Each request still
 * gets its own Router instance for navigation state.
 */
const serverViews = {
  /** @type {Promise<{ routes: Object[], layouts: Map, mergedAdapter: Object }>|null} */
  compiled: null,
  /** @type {Object|null} extension manager whose events invalidate the tree */
  subscribedTo: null,
};

/**
 * Drop the compiled tree so the next request rebuilds it.
 * Wired to extension load/unload events and to HMR.
 */
export function resetViewCache() {
  serverViews.compiled = null;
  resetDiscoveryCache();
}

function subscribeToExtensionChanges(extension) {
  if (!extension || serverViews.subscribedTo === extension) return;
  if (typeof extension.on !== 'function') return;

  const invalidate = () => {
    serverViews.compiled = null;
    if (__DEV__) log('Extension change detected — view routes will rebuild');
  };
  extension.on('extension:loaded', invalidate);
  extension.on('extension:unloaded', invalidate);
  extension.on('extensions:refreshed', invalidate);
  serverViews.subscribedTo = extension;
}

/**
 * Build the shared route tree: discover modules, build routes, inject
 * extension routes and append the catch-all.
 *
 * @param {Object} extension - Extension manager instance
 * @returns {Promise<{ routes: Object[], layouts: Map, mergedAdapter: Object, lifecycles: Map }>}
 */
async function compileServerViews(extension) {
  const startTime = Date.now();
  const { lifecycles, mergedAdapter } = await discoverViewModules(viewsContext);
  if (!mergedAdapter) {
    const err = new Error('No view modules found — cannot initialize router');
    err.name = 'NoViewModulesError';
    err.status = 500;
    throw err;
  }

  const router = new AppRouter(mergedAdapter, createRouterOptions(extension));

  // Inject buffered/stored extension routes into this tree. The extension
  // manager keeps a reference to this router for runtime installs; those
  // also invalidate the cache so later requests see a fresh tree.
  try {
    await extension.connectViewRouter(router);
  } catch (err) {
    log('Failed to connect extension manager: ' + err, 'error');
  }

  router.routes.push(createCatchAllRoute(router));

  log(`Route tree compiled in ${Date.now() - startTime}ms`);

  return {
    routes: router.routes,
    // eslint-disable-next-line no-underscore-dangle
    layouts: router._layouts,
    mergedAdapter,
    lifecycles,
  };
}

function getCompiledServerViews(extension) {
  subscribeToExtensionChanges(extension);
  if (!serverViews.compiled) {
    const pending = compileServerViews(extension);
    // A failed compile must not poison every later request
    pending.catch(() => {
      if (serverViews.compiled === pending) serverViews.compiled = null;
    });
    serverViews.compiled = pending;
  }
  return serverViews.compiled;
}

/**
 * Pre-build the route tree at boot so the first request pays nothing and a
 * broken module surfaces at startup rather than in a request log.
 *
 * @param {Object} extension - Extension manager instance
 */
export async function warmViews(extension) {
  await getCompiledServerViews(extension);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Creates the router by discovering per-module view contexts.
 *
 * @param {Object} context - Router initialization options
 * @param {Object} context.container - DI container instance (client or server)
 * @param {Object} context.store - Redux store instance
 * @param {Object} extension - Extension manager instance
 * @returns {Promise<Router>} Configured router instance
 */
export default async function initializeRouter(context, extension) {
  // Make extension manager available in the UI container
  context.container.instance('extension', extension);

  if (IS_SERVER) {
    const compiled = await getCompiledServerViews(extension);

    // Context-dependent phases (providers → boot) run per request
    await bootViewModules(compiled.lifecycles, context);

    return new AppRouter(compiled.mergedAdapter, {
      ...createRouterOptions(extension),
      compiled: { routes: compiled.routes, layouts: compiled.layouts },
    });
  }

  // Client: one long-lived router
  const { lifecycles, mergedAdapter } = await discoverViewModules(viewsContext);
  if (!mergedAdapter) {
    const err = new Error('No view modules found — cannot initialize router');
    err.name = 'NoViewModulesError';
    err.status = 500;
    throw err;
  }
  await bootViewModules(lifecycles, context);

  const router = new AppRouter(mergedAdapter, createRouterOptions(extension));

  // Connect the extension manager's view router so buffered routes are injected
  try {
    await extension.connectViewRouter(router);
  } catch (err) {
    log('Failed to connect extension manager: ' + err, 'error');
  }

  router.routes.push(createCatchAllRoute(router));
  log('Router initialized');
  return router;
}
