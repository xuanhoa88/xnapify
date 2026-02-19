/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import newsRoutes from './routes/news.routes';

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

/**
 * Initialize hook - runs on every application startup.
 * Use for registering event listeners, cron jobs, and mounting routes.
 *
 * @param {Object} app - Express app instance
 * @param {Router} apiRouter - Main API Router
 * @param {Object} options - Options
 * @param {Function} options.Router - Express Router constructor
 */
export async function init(app, apiRouter, { Router }) {
  const auth = app.get('auth');
  const webhook = app.get('webhook');
  const router = Router();

  // Full path will be: /api/news
  router.use('/news', newsRoutes(app, { Router }));

  // Full path will be: /api/activities (authenticated)
  router.use(
    '/activities',
    auth.middlewares.requireAuth(),
    webhook.createControllers(webhook, { Router }),
  );

  // Mount module routes to main API router
  apiRouter.use(router);
}
