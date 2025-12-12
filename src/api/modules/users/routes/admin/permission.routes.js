/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as permissionController from '../../controllers/admin/permission.controller';

/**
 * Permission Management Routes
 *
 * Handles permission CRUD operations and initialization.
 *
 * All routes require authentication and specific permissions.
 *
 * @param {Object} deps - Dependencies injected by parent router
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} middlewares - Authentication and authorization middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with permission routes
 */
export default function permissionRoutes(deps, middlewares, app) {
  const { requirePermission } = middlewares;
  const router = deps.Router();

  // Create auth middleware instance
  const auth = app.get('auth');
  const requireAuth = auth.middlewares.requireAuth();

  /**
   * @route   POST /
   * @desc    Create a new permission
   * @access  Admin (requires 'permissions:write' permission)
   * @body    { name, resource, action, description }
   */
  router.post(
    '/',
    requireAuth,
    requirePermission('permissions:write'),
    permissionController.createPermission,
  );

  /**
   * @route   GET /
   * @desc    Get all permissions with pagination
   * @access  Admin (requires 'permissions:read' permission)
   * @query   { page, limit, search, resource }
   */
  router.get(
    '/',
    requireAuth,
    requirePermission('permissions:read'),
    permissionController.getPermissions,
  );

  /**
   * @route   POST /initialize
   * @desc    Initialize default permissions
   * @access  Admin (requires 'system:admin' permission)
   */
  router.post(
    '/initialize',
    requireAuth,
    requirePermission('system:admin'),
    permissionController.initializeDefaults,
  );

  return router;
}
