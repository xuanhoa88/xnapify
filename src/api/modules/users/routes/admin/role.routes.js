/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as roleController from '../../controllers/admin/role.controller';

/**
 * Role Management Routes
 *
 * Handles role CRUD operations, permission assignments, and RBAC system setup.
 *
 * All routes require authentication and specific permissions.
 *
 * @param {Object} deps - Dependencies injected by parent router
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} middlewares - Authentication and authorization middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with role routes
 */
export default function roleRoutes(deps, middlewares, app) {
  const { requirePermission } = middlewares;
  const router = deps.Router();

  // Create auth middleware instance
  const auth = app.get('auth');
  const requireAuth = auth.middlewares.requireAuth();

  // ========================================================================
  // ROLE CRUD ROUTES
  // ========================================================================

  /**
   * @route   POST /initialize
   * @desc    Initialize roles, permissions and groups
   * @access  Admin (requires 'system:admin' permission)
   */
  router.post(
    '/initialize',
    requireAuth,
    requirePermission('system:admin'),
    roleController.initializeDefaults,
  );

  /**
   * @route   GET /list
   * @desc    Get all roles with pagination
   * @access  Admin (requires 'roles:read' permission)
   * @query   { page, limit, search }
   */
  router.get(
    '/list',
    requireAuth,
    requirePermission('roles:read'),
    roleController.getRoles,
  );

  /**
   * @route   POST /
   * @desc    Create a new role
   * @access  Admin (requires 'roles:write' permission)
   * @body    { name, description }
   */
  router.post(
    '/',
    requireAuth,
    requirePermission('roles:write'),
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
    requireAuth,
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
    requireAuth,
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
    requireAuth,
    requirePermission('roles:delete'),
    roleController.deleteRole,
  );

  /**
   * @route   PUT /:id/permissions
   * @desc    Assign permissions to a role
   * @access  Admin (requires 'roles:write' permission)
   * @param   {string} id - Role ID
   * @body    { permission_ids }
   */
  router.put(
    '/:id/permissions',
    requireAuth,
    requirePermission('roles:write'),
    roleController.assignPermissionsToRole,
  );

  return router;
}
