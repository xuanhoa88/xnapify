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

  /**
   * @route   GET /:id/members
   * @desc    Get group members
   * @access  Admin (requires 'groups:read' permission)
   */
  router.get(
    '/:id/members',
    requireAuth,
    requirePermission('groups:read'),
    groupController.getGroupMembers,
  );

  /**
   * @route   PUT /:id/roles
   * @desc    Assign roles to group
   * @access  Admin (requires 'groups:write' permission)
   * @body    { role_ids: [] }
   */
  router.put(
    '/:id/roles',
    requireAuth,
    requirePermission('groups:write'),
    groupController.assignRolesToGroup,
  );

  /**
   * @route   GET /:id
   * @desc    Get group by ID
   * @access  Admin (requires 'groups:read' permission)
   */
  router.get(
    '/:id',
    requireAuth,
    requirePermission('groups:read'),
    groupController.getGroupById,
  );

  /**
   * @route   PUT /:id
   * @desc    Update group by ID
   * @access  Admin (requires 'groups:write' permission)
   * @body    { name, description, category, type }
   */
  router.put(
    '/:id',
    requireAuth,
    requirePermission('groups:write'),
    groupController.updateGroup,
  );

  /**
   * @route   DELETE /:id
   * @desc    Delete group by ID
   * @access  Admin (requires 'groups:delete' permission)
   */
  router.delete(
    '/:id',
    requireAuth,
    requirePermission('groups:delete'),
    groupController.deleteGroup,
  );

  return router;
}
