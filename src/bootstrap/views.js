/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Router from '../shared/renderer/router';
import { getAppName, getAppDescription } from '../shared/renderer/redux';
import { createWebpackContextAdapter } from '../shared/utils/webpackContextAdapter';

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
 * Discover view modules and collect their view contexts and lifecycle hooks.
 *
 * Scans apps for views/index.js lifecycle files, calls hooks.views()
 * on each, and returns the collected context adapters along with
 * their full hook objects for lifecycle phases (e.g. shared).
 *
 * @returns {{ adapters: Map<string, object>, hooks: Map<string, object> }}
 */
function discoverViewModules() {
  const adapters = new Map();
  const moduleHooks = new Map();
  const lifecycleAdapter = createWebpackContextAdapter(viewsLifecycleContext);

  for (const filePath of lifecycleAdapter.files()) {
    const match = filePath.match(LIFECYCLE_PATTERN);
    if (!match) continue;

    const moduleName = match[1];

    try {
      const hooks = lifecycleAdapter.load(filePath);

      if (hooks && typeof hooks.views === 'function') {
        const viewContext = hooks.views();
        if (viewContext) {
          const rawAdapter = createWebpackContextAdapter(viewContext);
          const prefix = `./${moduleName}/views`;
          const wrappedAdapter = {
            files: () => rawAdapter.files().map(p => p.replace(/^\./, prefix)),
            load: p => rawAdapter.load(p.replace(prefix, '.')),
            resolve: p => rawAdapter.resolve(p.replace(prefix, '.')),
          };
          adapters.set(moduleName, wrappedAdapter);
          moduleHooks.set(moduleName, hooks);
        }
      } else {
        log(`[${moduleName}] No views() hook found, skipping`, 'warn');
      }
    } catch (error) {
      log(`[${moduleName}] Failed to load views: ${error.message}`, 'error');
    }
  }

  log(`${adapters.size} view module(s) discovered`);
  return { adapters, hooks: moduleHooks };
}

// =============================================================================
// ADAPTER MERGING
// =============================================================================

/**
 * Merges multiple per-module adapters into a single unified adapter.
 * This ensures layouts from any module (e.g. the (default) module's admin layout)
 * are globally visible when building routes for any other module.
 *
 * @param {Map<string, object>} adapters - Map of module name → adapter
 * @returns {object|null} Merged adapter or null if no adapters
 */
function mergeAdapters(adapters) {
  if (adapters.size === 0) return null;

  // Build file → adapter lookup for O(1) resolution
  const fileMap = new Map();
  const allFiles = [];

  for (const adapter of adapters.values()) {
    for (const file of adapter.files()) {
      if (!fileMap.has(file)) {
        fileMap.set(file, adapter);
        allFiles.push(file);
      }
    }
  }

  return {
    files: () => allFiles,
    load: path => {
      const adapter = fileMap.get(path);
      if (!adapter) {
        throw new Error(`View file not found in any module: ${path}`);
      }
      return adapter.load(path);
    },
    resolve: path => {
      const adapter = fileMap.get(path);
      return adapter ? adapter.resolve(path) : null;
    },
  };
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
 * @param {Object} options.plugin - Plugin manager instance (client or server)
 * @param {Object} options.container - DI container instance (client or server)
 * @returns {Promise<Router>} Configured router instance
 */
export default async function initializeRouter(options = {}) {
  // ─── Initialize ─────────────────────────────────────────────────────
  const { plugin, container } = options;

  // Discover per-module view adapters and lifecycle hooks
  const { adapters: viewAdapters, hooks: moduleHooks } = discoverViewModules();

  // ─── Shared phase ─────────────────────────────────────────────────────
  // Call each module's providers() hook to allow cross-module sharing
  // (e.g. registering Redux slices, shared components, DI bindings).
  // Always re-run providers — persistent bindings on the Container itself
  // guard against double-registration on the same instance.
  for (const [name, hooks] of moduleHooks) {
    if (typeof hooks.providers === 'function') {
      try {
        await hooks.providers({ plugin, container });
        log(`[${name}] Providers`);
      } catch (error) {
        // PersistentBindingError = idempotent re-registration on same container
        if (error.name !== 'PersistentBindingError') {
          log(`[${name}] Providers phase failed: ${error.message}`, 'error');
        }
      }
    }
  }

  // ─── Merge adapters ─────────────────────────────────────────────────────
  // Merge all adapters into one combined adapter so that layouts
  // from any module (e.g. (default)'s admin layout) are globally
  // visible when building routes for any other module.
  const mergedAdapter = mergeAdapters(viewAdapters);

  if (!mergedAdapter) {
    throw new Error('No view modules found — cannot initialize router');
  }

  const router = new AppRouter(mergedAdapter, {
    context: {
      plugin,
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
      const ns = route.workspace || (route.module && route.module.workspace);
      const manager = ctx.plugin || plugin;

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
      const ns = route.workspace || (route.module && route.module.workspace);
      const manager = ctx.plugin || plugin;

      if (ns && manager) {
        if (__DEV__) {
          console.log(`[Router] Unloading plugin namespace: ${ns}`);
        }
        await manager.unloadNamespace(ns);
      }
    },
  });

  // Append catch-all route for 404s
  router.routes.push({
    path: '/*path',
    action: context => router.resolve({ ...context, pathname: '/not-found' }),
  });

  log('Router initialized');
  return router;
}
