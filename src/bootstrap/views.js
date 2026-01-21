/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Router from '../shared/renderer/router';
import { getAppName, getAppDescription } from '../shared/renderer/redux';

// Webpack context for all collectable module files
// Note: require.context requires a static regex literal for webpack to analyze
const modulesContext = require.context(
  '../modules',
  true,
  /(?:\/views\/.*\/_route|\/\(routes\)\/\([^)]+\)|\/\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
);

/**
 * Creates an adapter for webpack's require.context to match the expected interface
 */
function createContextAdapter(ctx) {
  return {
    files: () => ctx.keys(),
    load: path => ctx(path),
  };
}

class AppRouter extends Router {
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
  return new AppRouter(createContextAdapter(modulesContext), {
    context: {
      // Init context here if needed
    },
  });
}
