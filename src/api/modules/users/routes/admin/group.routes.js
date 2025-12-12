/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as groupController from '../../controllers/admin/group.controller';

/**
 * Group Management Routes
 *
 * Handles group CRUD operations.
 *
 * All routes require authentication and specific permissions.
 *
 * @param {Object} deps - Dependencies injected by parent router
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} middlewares - Authentication and authorization middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with group routes
 */
export default function groupRoutes(deps, middlewares, app) {
  const { requirePermission } = middlewares;
  const router = deps.Router();

  // Create auth middleware instance
  const auth = app.get('auth');
  const requireAuth = auth.middlewares.requireAuth();

  /**
   * @route   POST /
   * @desc    Create a new group
   * @access  Admin (requires 'groups:write' permission)
   * @body    { name, description, category, type }
   */
  router.post(
    '/',
    requireAuth,
    requirePermission('groups:write'),
    groupController.createGroup,
  );

  /**
   * @route   GET /
   * @desc    Get all groups with pagination
   * @access  Admin (requires 'groups:read' permission)
   * @query   { page, limit, search, category, type }
   */
  router.get(
    '/',
    requireAuth,
    requirePermission('groups:read'),
    groupController.getGroups,
  );

  return router;
}
