/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Router } from 'express';
import * as controller from './controller';

/**
 * Initialize plugins module API
 *
 * @param {Object} app - Express app instance
 * @param {Router} apiRouter - Main API Router
 */
export async function init(app, apiRouter) {
  const router = Router();

  // List all plugins
  router.get('/plugins', controller.listPlugins);

  // Get plugin metadata and script URL
  router.get('/plugins/:id', controller.getPlugin);

  // Mount routes
  apiRouter.use(router);

  console.info('✅ [plugins] API routes registered');
}
