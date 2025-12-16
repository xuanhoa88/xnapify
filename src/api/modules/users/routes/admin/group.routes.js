/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as groupController from '../../controllers/admin/group.controller';
import * as rbacController from '../../controllers/admin/rbac.controller';

/**
 * Group Management Routes
 *
 * Handles group CRUD operations.
 *
 * All routes require authentication and specific permissions.
 *
 * @param {Object} deps - Dependencies injected by parent router
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} userMiddlewares - Authentication and authorization middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with group routes
 */
export default function groupRoutes(deps, userMiddlewares) {
  const { requirePermission } = userMiddlewares;
  const router = deps.Router();

  /**
   * @route   GET /
   * @desc    Get all groups with pagination
   * @access  Admin (requires 'groups:read' permission)
   * @query   { page, limit, search, category, type }
   */
  router.get(
    '/list',
    requirePermission('groups:read'),
    groupController.getGroups,
  );

  /**
   * @route   POST /
   * @desc    Create a new group
   * @access  Admin (requires 'groups:write' permission)
   * @body    { name, description, category, type }
   */
  router.post(
    '/',
    requirePermission('groups:write'),
    groupController.createGroup,
  );

  /**
   * @route   GET /:id/members
   * @desc    Get group members
   * @access  Admin (requires 'groups:read' permission)
   */
  router.get(
    '/:id/members',
    requirePermission('groups:read'),
    groupController.getGroupMembers,
  );

  /**
   * @route   PUT /:id/roles
   * @desc    Assign roles to group
   * @access  Admin (requires 'groups:write' permission)
   * @body    { role_names: [] }
   */
  router.put(
    '/:id/roles',
    requirePermission('groups:write'),
    rbacController.assignRolesToGroup,
  );

  /**
   * @route   POST /:id/roles/:role_id
   * @desc    Add a single role to group
   * @access  Admin (requires 'groups:write' permission)
   */
  router.post(
    '/:id/roles/:role_id',
    requirePermission('groups:write'),
    rbacController.addRoleToGroup,
  );

  /**
   * @route   DELETE /:id/roles/:role_id
   * @desc    Remove a role from group
   * @access  Admin (requires 'groups:write' permission)
   */
  router.delete(
    '/:id/roles/:role_id',
    requirePermission('groups:write'),
    rbacController.removeRoleFromGroup,
  );

  /**
   * @route   GET /:id
   * @desc    Get group by ID
   * @access  Admin (requires 'groups:read' permission)
   */
  router.get(
    '/:id',
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
    requirePermission('groups:write'),
    groupController.updateGroupById,
  );

  /**
   * @route   DELETE /:id
   * @desc    Delete group by ID
   * @access  Admin (requires 'groups:delete' permission)
   */
  router.delete(
    '/:id',
    requirePermission('groups:delete'),
    groupController.deleteGroup,
  );

  return router;
}
