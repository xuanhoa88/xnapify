/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import newsRoutes from './news.routes';

/**
 * Homepage Module Factory
 *
 * This module provides homepage feed data.
 * Routes are mounted directly on the router (will be under /api when mounted by API bootstrap).
 *
 * @param {Object} deps - Dependencies injected by API bootstrap
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} app - Express app instance (for accessing app-level settings)
 * @returns {Router} Express router with news routes
 */
export default function homepageModule({ Router }, app) {
  const auth = app.get('auth');
  const webhook = app.get('webhook');
  const router = Router();

  // Full path will be: /api/news (when mounted by API bootstrap)
  router.use('/news', newsRoutes({ Router }));

  // Full path will be: /api/activities (when mounted by API bootstrap)
  router.use(
    '/activities',
    auth.requireAuthMiddleware(),
    webhook.createControllers(webhook),
  );

  return router;
}
