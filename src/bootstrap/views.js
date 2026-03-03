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
const lifecycleAdapter = createWebpackContextAdapter(viewsLifecycleContext);

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
 * Discover view lifecycle modules and collect their hooks.
 *
 * Only loads module files and extracts hook references — does NOT
 * call any hooks (views, providers, etc.). This is intentional so
 * the caller controls the lifecycle ordering.
 *
 * @returns {Map<string, object>} Map of module name → lifecycle hooks
 */
function discoverModuleHooks() {
  const moduleHooks = new Map();

  for (const filePath of lifecycleAdapter.files()) {
    const match = filePath.match(LIFECYCLE_PATTERN);
    if (!match) continue;

    const moduleName = match[1];

    try {
      const hooks = lifecycleAdapter.load(filePath);
      if (hooks) {
        moduleHooks.set(moduleName, hooks);
      } else {
        log(`[${moduleName}] No lifecycle hooks found, skipping`, 'warn');
      }
    } catch (error) {
      log(`[${moduleName}] Failed to load module: ${error.message}`, 'error');
    }
  }

  log(`${moduleHooks.size} module(s) discovered`);
  return moduleHooks;
}

/**
 * Collect view adapters by calling each module's views() hook.
 *
 * Must be called AFTER providers phase so that views can depend
 * on bindings registered during providers.
 *
 * @param {Map<string, object>} moduleHooks - Discovered module hooks
 * @returns {Map<string, object>} Map of module name → view adapter
 */
function collectViewAdapters(moduleHooks) {
  const adapters = new Map();

  for (const [moduleName, hooks] of moduleHooks) {
    if (typeof hooks.views !== 'function') continue;

    try {
      const viewContext = hooks.views();
      if (viewContext) {
        const rawAdapter = createWebpackContextAdapter(viewContext);
        const prefix = `./${moduleName}/views`;
        adapters.set(moduleName, {
          files: () => rawAdapter.files().map(p => p.replace(/^\./, prefix)),
          load: p => rawAdapter.load(p.replace(prefix, '.')),
          resolve: p => rawAdapter.resolve(p.replace(prefix, '.')),
        });
      }
    } catch (error) {
      log(`[${moduleName}] Failed to load views: ${error.message}`, 'error');
    }
  }

  log(`${adapters.size} view adapter(s) collected`);
  return adapters;
}

// =============================================================================
// PROVIDER REGISTRATION
// =============================================================================

/**
 * Run all discovered modules' providers() hooks on the given container.
 *
 * @param {Map<string, object>} moduleHooks - Map of module name → lifecycle hooks
 * @param {Object} ctx - Context containing { plugin, container }
 */
async function runModuleProviders(moduleHooks, { container }) {
  for (const [name, hooks] of moduleHooks) {
    if (typeof hooks.providers === 'function') {
      try {
        await hooks.providers({ container });
        log(`[${name}] Providers`);
      } catch (error) {
        // PersistentBindingError = idempotent re-registration on same container
        if (error.name !== 'PersistentBindingError') {
          log(`[${name}] Providers phase failed: ${error.message}`, 'error');
        }
      }
    }
  }
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

  // 1. Discover — load lifecycle modules, collect hook references only
  const moduleHooks = discoverModuleHooks();

  // 2. Providers — register cross-module bindings (e.g. DI, Redux slices)
  await runModuleProviders(moduleHooks, { container });

  // 3. Views — call views() on each module to get their route contexts
  const viewAdapters = collectViewAdapters(moduleHooks);

  // 4. Merge adapters so layouts from any module are globally visible
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
      const ns =
        route.workspace ||
        (route.module && route.module.workspace) ||
        route.path;
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
      const ns =
        route.workspace ||
        (route.module && route.module.workspace) ||
        route.path;
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
