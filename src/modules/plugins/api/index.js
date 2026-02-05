/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import pluginRoutes from './routes/plugin.routes';

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

/**
 * Initialize plugins module API
 *
 * @param {Object} app - Express app instance
 * @param {Router} apiRouter - Main API Router
 */
export async function init(app, apiRouter) {
  // Mount plugin routes
  apiRouter.use('/plugins', pluginRoutes(app));

  console.info('✅ [plugins] API routes registered');
}
