/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as roleController from '../../controllers/admin/role.controller';
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
   * @route   GET /list
   * @desc    Get all roles with pagination
   * @access  Admin (requires 'roles:read' permission)
   * @query   { page, limit, search }
   */
  router.get('/list', requirePermission('roles:read'), roleController.getRoles);

  /**
   * @route   POST /
   * @desc    Create a new role
   * @access  Admin (requires 'roles:write' permission)
   * @body    { name, description }
   */
  router.post('/', requirePermission('roles:write'), roleController.createRole);

  /**
   * @route   GET /:id
   * @desc    Get role by ID
   * @access  Admin (requires 'roles:read' permission)
   * @param   {string} id - Role ID
   */
  router.get(
    '/:id',
    requirePermission('roles:read'),
    roleController.getRoleById,
  );

  /**
   * @route   PUT /:id
   * @desc    Update role by ID
   * @access  Admin (requires 'roles:write' permission)
   * @param   {string} id - Role ID
   * @body    { name?, description? }
   */
  router.put(
    '/:id',
    requirePermission('roles:write'),
    roleController.updateRole,
  );

  /**
   * @route   DELETE /:id
   * @desc    Delete role by ID
   * @access  Admin (requires 'roles:delete' permission)
   * @param   {string} id - Role ID
   */
  router.delete(
    '/:id',
    requirePermission('roles:delete'),
    roleController.deleteRole,
  );

  // ========================================================================
  // ROLE USERS & GROUPS ROUTES
  // ========================================================================

  /**
   * @route   GET /:id/users
   * @desc    Get users assigned to a role
   * @access  Admin (requires 'roles:read' permission)
   * @param   {string} id - Role ID
   * @query   { page, limit }
   */
  router.get(
    '/:id/users',
    requirePermission('roles:read'),
    roleController.getRoleUsers,
  );

  /**
   * @route   GET /:id/groups
   * @desc    Get groups assigned to a role
   * @access  Admin (requires 'roles:read' permission)
   * @param   {string} id - Role ID
   * @query   { page, limit }
   */
  router.get(
    '/:id/groups',
    requirePermission('roles:read'),
    roleController.getRoleGroups,
  );

  // ========================================================================
  // ROLE-PERMISSION ROUTES (via RBAC Controller)
  // ========================================================================

  /**
   * @route   PUT /:id/permissions
   * @desc    Assign permissions to a role
   * @access  Admin (requires 'roles:write' permission)
   * @param   {string} id - Role ID
   * @body    { permission_ids }
   */
  router.put(
    '/:id/permissions',
    requirePermission('roles:write'),
    rbacController.assignPermissionsToRole,
  );

  /**
   * @route   POST /:id/permissions/:permission_id
   * @desc    Add a single permission to a role
   * @access  Admin (requires 'roles:write' permission)
   */
  router.post(
    '/:id/permissions/:permission_id',
    requirePermission('roles:write'),
    rbacController.addPermissionToRole,
  );

  /**
   * @route   DELETE /:id/permissions/:permission_id
   * @desc    Remove a permission from a role
   * @access  Admin (requires 'roles:write' permission)
   */
  router.delete(
    '/:id/permissions/:permission_id',
    requirePermission('roles:write'),
    rbacController.removePermissionFromRole,
  );

  return router;
}
