/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as rbacController from '../../controllers/admin/rbac.controller';

/**
 * Role Management Routes
 *
 * Handles role CRUD operations, permission assignments, and RBAC system setup.
 *
 * All routes require authentication and specific permissions.
 *
 * @param {Object} deps - Dependencies injected by parent router
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} userMiddlewares - Authentication and authorization middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with role routes
 */
export default function roleRoutes(deps, userMiddlewares) {
  const { requirePermission } = userMiddlewares;
  const router = deps.Router();

  /**
   * @route   POST /initialize
   * @desc    Initialize roles, permissions and groups
   * @access  Admin (requires '*:*' permission - super admin)
   */
  router.post(
    '/initialize',
    requirePermission('*:*'),
    rbacController.initializeDefaults,
  );

  return router;
}
