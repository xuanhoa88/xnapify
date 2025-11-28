/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  roleController,
  permissionController,
  groupController,
  userAssignmentController,
  systemController,
} from '../controllers';

/**
 * RBAC (Role-Based Access Control) Routes
 *
 * Handles role, permission, and group management operations as well as
 * user assignments and system initialization.
 *
 * All routes require authentication and specific permissions.
 *
 * @param {Object} deps - Dependencies injected by parent router
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} middlewares - Authentication and authorization middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with RBAC routes
 */
export default function rbacRoutes(deps, middlewares, app) {
  const { requirePermission, requireAnyPermission } = middlewares;
  const router = deps.Router();

  // Create auth middleware instance
  const auth = app.get('auth');
  const requireAuth = auth.middlewares.requireAuth({
    jwtSecret: app.get('jwtSecret'),
  });

  // ========================================================================
  // ROLE MANAGEMENT ROUTES
  // ========================================================================

  /**
   * @route   POST /roles
   * @desc    Create a new role
   * @access  Admin (requires 'roles:write' permission)
   * @body    { name, description }
   */
  router.post(
    '/roles',
    requireAuth,
    requirePermission('roles:write'),
    roleController.createRole,
  );

  /**
   * @route   GET /roles
   * @desc    Get all roles with pagination
   * @access  Admin (requires 'roles:read' permission)
   * @query   { page, limit, search }
   */
  router.get(
    '/roles',
    requireAuth,
    requirePermission('roles:read'),
    roleController.getRoles,
  );

  /**
   * @route   PUT /roles/:id/permissions
   * @desc    Assign permissions to a role
   * @access  Admin (requires 'roles:write' permission)
   * @param   {string} id - Role ID
   * @body    { permission_ids }
   */
  router.put(
    '/roles/:id/permissions',
    requireAuth,
    requirePermission('roles:write'),
    roleController.assignPermissionsToRole,
  );

  // ========================================================================
  // PERMISSION MANAGEMENT ROUTES
  // ========================================================================

  /**
   * @route   POST /permissions
   * @desc    Create a new permission
   * @access  Admin (requires 'permissions:write' permission)
   * @body    { name, resource, action, description }
   */
  router.post(
    '/permissions',
    requireAuth,
    requirePermission('permissions:write'),
    permissionController.createPermission,
  );

  /**
   * @route   GET /permissions
   * @desc    Get all permissions with pagination
   * @access  Admin (requires 'permissions:read' permission)
   * @query   { page, limit, search, resource }
   */
  router.get(
    '/permissions',
    requireAuth,
    requirePermission('permissions:read'),
    permissionController.getPermissions,
  );

  /**
   * @route   POST /permissions/initialize
   * @desc    Initialize default permissions
   * @access  Admin (requires 'system:admin' permission)
   */
  router.post(
    '/permissions/initialize',
    requireAuth,
    requirePermission('system:admin'),
    permissionController.initializeDefaultPermissions,
  );

  // ========================================================================
  // GROUP MANAGEMENT ROUTES
  // ========================================================================

  /**
   * @route   POST /groups
   * @desc    Create a new group
   * @access  Admin (requires 'groups:write' permission)
   * @body    { name, description, category, type }
   */
  router.post(
    '/groups',
    requireAuth,
    requirePermission('groups:write'),
    groupController.createGroup,
  );

  /**
   * @route   GET /groups
   * @desc    Get all groups with pagination
   * @access  Admin (requires 'groups:read' permission)
   * @query   { page, limit, search, category, type }
   */
  router.get(
    '/groups',
    requireAuth,
    requirePermission('groups:read'),
    groupController.getGroups,
  );

  // ========================================================================
  // USER ASSIGNMENT ROUTES
  // ========================================================================

  /**
   * @route   PUT /users/:id/roles
   * @desc    Assign roles to a user
   * @access  Admin (requires 'users:manage' permission)
   * @param   {string} id - User ID
   * @body    { role_ids }
   */
  router.put(
    '/users/:id/roles',
    requireAuth,
    requirePermission('users:manage'),
    userAssignmentController.assignRolesToUser,
  );

  /**
   * @route   PUT /users/:id/groups
   * @desc    Assign groups to a user
   * @access  Admin (requires 'users:manage' permission)
   * @param   {string} id - User ID
   * @body    { group_ids }
   */
  router.put(
    '/users/:id/groups',
    requireAuth,
    requirePermission('users:manage'),
    userAssignmentController.assignGroupsToUser,
  );

  /**
   * @route   GET /users/:id/permissions
   * @desc    Get user's effective permissions
   * @access  Admin (requires 'users:read' permission) or Self
   * @param   {string} id - User ID
   */
  router.get(
    '/users/:id/permissions',
    requireAuth,
    requireAnyPermission(['users:read', 'users:manage']),
    userAssignmentController.getUserPermissions,
  );

  /**
   * @route   GET /users/:id/permissions/:permission
   * @desc    Check if user has specific permission
   * @access  Admin (requires 'users:read' permission) or Self
   * @param   {string} id - User ID
   * @param   {string} permission - Permission name
   */
  router.get(
    '/users/:id/permissions/:permission',
    requireAuth,
    requireAnyPermission(['users:read', 'users:manage']),
    userAssignmentController.checkUserPermission,
  );

  // ========================================================================
  // SYSTEM INITIALIZATION ROUTES
  // ========================================================================

  /**
   * @route   POST /initialize
   * @desc    Initialize complete RBAC system
   * @access  Admin (requires 'system:admin' permission)
   */
  router.post(
    '/initialize',
    requireAuth,
    requirePermission('system:admin'),
    systemController.initializeRBAC,
  );

  return router;
}
