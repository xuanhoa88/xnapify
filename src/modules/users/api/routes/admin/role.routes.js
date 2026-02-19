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
 * @param {Object} app - Express application instance
 * @param {Object} options - Options
 * @param {Function} options.Router - Express Router constructor
 * @returns {Router} Express router with role routes
 */
export default function roleRoutes(app, { Router }) {
  const { requirePermission } = app.get('auth').middlewares;
  const router = Router();

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
   * @access  Admin (requires 'roles:create' permission)
   * @body    { name, description }
   */
  router.post(
    '/',
    requirePermission('roles:create'),
    roleController.createRole,
  );

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
   * @access  Admin (requires 'roles:update' permission)
   * @param   {string} id - Role ID
   * @body    { name?, description? }
   */
  router.put(
    '/:id',
    requirePermission('roles:update'),
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
   * @route   GET /:id/permissions
   * @desc    Get permissions assigned to a role
   * @access  Admin (requires 'roles:read' permission)
   * @param   {string} id - Role ID
   */
  router.get(
    '/:id/permissions',
    requirePermission('roles:read'),
    rbacController.getRolePermissions,
  );

  /**
   * @route   PUT /:id/permissions
   * @desc    Manage role permissions (add/remove/replace)
   * @access  Admin (requires 'roles:update' permission)
   * @param   {string} id - Role ID
   * @body    { action: 'add'|'remove'|'replace', permissions: ["resource:action", ...] }
   */
  router.put(
    '/:id/permissions',
    requirePermission('roles:update'),
    rbacController.manageRolePermissions,
  );

  return router;
}
