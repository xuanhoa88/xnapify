/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { activateLocale } from '@shared/i18n/resources.js';
import {
  discoverViewModules,
  bootViewModules,
  resetDiscoveryCache,
  runMenuModules,
} from '@shared/renderer/autoloader.js';
import { features } from '@shared/renderer/redux/index.js';
import { materializeTree } from '@shared/renderer/router/builder.js';
import Router from '@shared/renderer/router/index.js';
import { getRouteNamespace } from '@shared/renderer/router/utils.js';
const { getAppName, getAppDescription } = features;

// Discover view lifecycle modules from apps directory
const viewsContext = import.meta.webpackContext('../apps', {
  recursive: true,
  regExp: /^\.\/[^/]+\/views\/index\.[cm]?[jt]s$/i,
});

const IS_SERVER = typeof window === 'undefined';

/** @type {Function|null} Client-only i18next listener that relabels menus */
let localeMenuListener = null;

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
 * Whether an error is the bundler's "chunk failed to load" error.
 *
 * Views are lazily chunked, so a stale deploy or a dropped connection
 * surfaces here rather than at boot. Matched by name and message because
 * rspack's runtime throws a plain Error in some paths.
 *
 * @param {Error} error - Error thrown during a resolve
 * @returns {boolean}
 */
function isChunkLoadError(error) {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  return /Loading chunk \S+ failed|ChunkLoadError/i.test(error.message || '');
}

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

      // The error page is a lazily loaded chunk like any other view, so it
      // can fail exactly the way the route that got us here did. Answering a
      // failed chunk load with another chunk load recurses forever — after a
      // deploy every old chunk URL 404s, so the retry never succeeds and the
      // outer resolve never settles. Hand these back to the caller instead:
      // src/client.js reloads the page on a chunk error, which is the only
      // recovery that works against a stale bundle.
      if (isChunkLoadError(error) || ctx.pathname === '/error') {
        throw error;
      }

      const { _instance, ...context } = ctx;
      return _instance.resolve({
        ...context,
        error,
        pathname: '/error',
      });
    },
    async onRouteInit(route, ctx) {
      // A dictionary whose chunk failed to arrive leaves its namespace
      // resolving to raw keys for the rest of the session: the loader
      // records the failure and nothing re-enters it unless the language
      // changes. Retrying per navigation heals that, and costs nothing when
      // everything is loaded — each locale is memoised per namespace.
      if (!IS_SERVER) {
        try {
          const locale =
            (ctx && ctx.locale) || (ctx && ctx.i18n && ctx.i18n.language);
          if (locale) await activateLocale(locale);
        } catch (err) {
          log('Failed to refresh translations: ' + err, 'warn');
        }
      }

      try {
        const ns = getRouteNamespace(route);
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
    // `onRouteUnmount` is the name the router calls (see runUnmount in
    // shared/renderer/router/lifecycle.js). This was declared as
    // `onRouteDestroy`, which nothing invokes, so namespace teardown never
    // ran in the browser and a plugin activated for one route stayed booted
    // for the life of the page.
    async onRouteUnmount(route) {
      try {
        const ns = getRouteNamespace(route);
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

  // The view contexts are lazy so the browser gets one chunk per route. On
  // the server that split has no value and a cost, so load every view now:
  // rendering stays free of per-request module loads and a broken view fails
  // the boot instead of the first request that happens to hit it.
  await materializeTree(router.routes);

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

    // Extensions are loaded once at boot, but their menu payloads are built
    // from this request's store and language, so their `menus` phase has to
    // run here too — otherwise an extension's sidebar entry is missing from
    // the server-rendered markup and only appears after hydration.
    await extension.runViewMenus(context);

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
  await extension.runViewMenus(context);

  const router = new AppRouter(mergedAdapter, createRouterOptions(extension));

  // Connect the extension manager's view router so buffered routes are injected
  try {
    await extension.connectViewRouter(router);
  } catch (err) {
    log('Failed to connect extension manager: ' + err, 'error');
  }

  router.routes.push(createCatchAllRoute(router));

  // Menu payloads carry translated strings, so they belong to the language
  // they were built in. The server rebuilds them per request; the browser
  // boots once, so without this the sidebar keeps the boot-time language
  // after a switch while everything around it changes — the behaviour the
  // route-level `setup()` hook used to provide by re-running on every
  // navigation. `registerMenu` overwrites by id, so this only relabels.
  watchLocaleForMenus(lifecycles, context, extension);

  log('Router initialized');
  return router;
}

/**
 * Re-run the `menus` phase whenever i18next switches language (client only).
 *
 * Bound once per module context; a re-init after HMR replaces the listener
 * rather than stacking a second one.
 *
 * @param {Map<string, object>} lifecycles - Module name → hooks
 * @param {Object} context - DI context handed to the menus hook
 * @param {Object} extension - Extension manager, whose menus are relabelled too
 */
function watchLocaleForMenus(lifecycles, context, extension) {
  const { i18n } = context;
  if (!i18n || typeof i18n.on !== 'function') return;

  if (localeMenuListener) {
    if (typeof i18n.off === 'function') {
      i18n.off('languageChanged', localeMenuListener);
    }
    localeMenuListener = null;
  }

  localeMenuListener = () => {
    runMenuModules(lifecycles, context)
      .then(errors => {
        if (errors.length > 0) {
          log(`Menu refresh reported ${errors.length} error(s)`, 'warn');
        }
        // Extension menus carry translated labels too.
        return extension.runViewMenus(context);
      })
      .catch(err => log(`Menu refresh failed: ${err.message}`, 'warn'));
  };

  i18n.on('languageChanged', localeMenuListener);
}
