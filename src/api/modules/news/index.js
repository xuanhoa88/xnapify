/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import routes from './news.routes';

/**
 * News Module Factory
 *
 * This module provides news feed data.
 * Routes are mounted directly on the router (will be under /api when mounted by API bootstrap).
 *
 * Module Structure:
 * - Routes: GET /news - Returns list of news items
 * - No models (uses mock data)
 * - No authentication required
 *
 * @param {Object} deps - Dependencies injected by API bootstrap
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} app - Express app instance (for accessing app-level settings)
 * @returns {Router} Express router with news routes
 *
 * @example
 * // Called by API bootstrap during module discovery
 * const newsRouter = newsModule({ Router }, app);
 * // Router will be mounted at /api/news
 */
export default function newsModule({ Router }) {
  const router = Router();

  // Mount news routes directly
  // Full path will be: /api/news (when mounted by API bootstrap)
  router.use('/news', routes);

  return router;
}
