/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import createRouter, { defaultResolver } from '../shared/renderer/router';
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

/**
 * Custom route resolver that enriches pages with app metadata
 */
async function routeResolver(ctx, options) {
  const page = await defaultResolver(ctx, options);
  if (!page) return null;

  const state = ctx.store.getState();
  const appName = getAppName(state);
  const appDescription = getAppDescription(state);

  return {
    ...page,
    title: page.title ? `${page.title} - ${appName}` : appName,
    description: page.description || appDescription,
  };
}

/**
 * Creates the router with webpack module context
 *
 * @returns {Promise<Router>} Configured router instance
 */
export default async function initializeRouter() {
  return createRouter(createContextAdapter(modulesContext), {
    resolver: routeResolver,
  });
}
