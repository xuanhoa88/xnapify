/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Router from '../shared/renderer/router';
import { getAppName, getAppDescription } from '../shared/renderer/redux';
import { createContextAdapter } from '../shared/context';
import { pluginRegistry } from '../shared/plugin';

// Webpack context for all collectable module files
const modulesContext = require.context(
  '../modules',
  true,
  /^\.\/[^/]+\/(?:(?:views\/)?(?:[^/]+\/)*)?(?:_route|_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
);

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

/**
 * Creates the router with webpack module context
 *
 * @returns {Promise<Router>} Configured router instance
 */
export default async function initializeRouter() {
  const router = new AppRouter(createContextAdapter(modulesContext), {
    context: {
      // Add plugin registry to context
      pluginRegistry,
    },
    errorHandler(error, ctx) {
      // Handle other errors (500, etc)
      if (__DEV__ && error.status !== 403) {
        console.error('Router Error:', error);
        // In dev, let it bubble up to see the stack trace or overlay
        throw error;
      }

      // Remove internal router instance from context
      const { _instance, ...context } = ctx;

      // In production, show generic error page
      return _instance.resolve({
        ...context,
        pathname: '/error',
        error, // Pass error to component if it accepts it
      });
    },
    async onRouteMount(route, _ctx) {
      // Check both route property (from bindPluginNamespace) and module export
      const namespace =
        route.pluginNamespace || (route.module && route.module.pluginNamespace);

      if (namespace) {
        if (!pluginRegistry.isNamespaceInstalled(namespace)) {
          console.log(`[Router] Installing plugin namespace: ${namespace}`);
          await pluginRegistry.installNamespace(namespace);
        } else {
          console.log(
            `[Router] Plugin namespace already installed: ${namespace}`,
          );
        }
      }
    },
    async onRouteUnmount(route, _ctx) {
      if (route.pluginNamespace) {
        await pluginRegistry.uninstallNamespace(route.pluginNamespace);
      }
    },
  });

  // Append catch-all route for 404s
  router.routes.push({
    path: '/*path',
    action: context => router.resolve({ ...context, pathname: '/not-found' }),
  });

  return router;
}
