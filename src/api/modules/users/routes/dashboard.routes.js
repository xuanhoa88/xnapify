/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { dashboardController } from '../controllers';

/**
 * Dashboard Routes
 *
 * Handles admin dashboard endpoints for statistics and recent activity.
 *
 * All routes require admin privileges.
 *
 * @param {Object} deps - Dependencies injected by parent router
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} middlewares - Authentication middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with dashboard routes
 */
export default function dashboardRoutes(deps, middlewares, app) {
  const { requireAdmin } = middlewares;
  const router = deps.Router();

  // Create auth middleware instance
  const auth = app.get('auth');
  const requireAuth = auth.middlewares.requireAuth({
    jwtSecret: app.get('jwtSecret'),
  });

  /**
   * @route   GET /
   * @desc    Get dashboard statistics and recent activity
   * @access  Admin only
   */
  router.get('/', requireAuth, requireAdmin, dashboardController.getDashboard);

  return router;
}
