/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as userController from '../../controllers/admin/user.controller';
import * as userAssignmentController from '../../controllers/admin/user-assignment.controller';
import * as dashboardController from '../../controllers/admin/dashboard.controller';

/**
 * User Administration Routes
 *
 * Handles administrative user management operations including user listing,
 * viewing, updating, deleting, role/group assignments, and status management.
 *
 * All routes require admin privileges.
 *
 * @param {Object} deps - Dependencies injected by parent router
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} middlewares - Authentication middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with user admin routes
 */
export default function userRoutes(deps, middlewares, app) {
  const { requireAdmin, requirePermission, requireAnyPermission } = middlewares;
  const router = deps.Router();

  // Create auth middleware instance
  const auth = app.get('auth');

  // Create requireAuth middleware
  const requireAuth = auth.middlewares.requireAuth();

  // ========================================================================
  // DASHBOARD ROUTES
  // ========================================================================

  /**
   * @route   GET /dashboard
   * @desc    Get dashboard statistics and recent activity
   * @access  Admin only
   */
  router.get(
    '/dashboard',
    requireAuth,
    requireAdmin,
    dashboardController.getDashboard,
  );

  // ========================================================================
  // USER CRUD ROUTES
  // ========================================================================

  /**
   * @route   GET /list
   * @desc    Get paginated list of all users
   * @access  Admin only
   * @query   { page, limit, search, role, status }
   */
  router.get('/list', requireAuth, requireAdmin, userController.getUserList);

  /**
   * @route   GET /generate-password
   * @desc    Generate a random secure password
   * @access  Admin only
   * @query   { length, includeSymbols }
   */
  router.get(
    '/generate-password',
    requireAuth,
    requireAdmin,
    userController.generateRandomPassword,
  );

  /**
   * @route   GET /stats
   * @desc    Get user statistics
   * @access  Admin only
   */
  router.get('/stats', requireAuth, requireAdmin, userController.getUserStats);

  /**
   * @route   PUT /bulk
   * @desc    Bulk update users
   * @access  Admin only
   * @body    { user_ids, updates }
   */
  router.put(
    '/bulk',
    requireAuth,
    requireAdmin,
    userController.bulkUpdateUsers,
  );

  /**
   * @route   GET /:id
   * @desc    Get specific user by ID
   * @access  Admin only
   * @param   {string} id - User ID
   */
  router.get('/:id', requireAuth, requireAdmin, userController.getUserById);

  /**
   * @route   PUT /:id
   * @desc    Update user by ID
   * @access  Admin only
   * @param   {string} id - User ID
   * @body    { email, display_name, is_active, email_confirmed }
   */
  router.put('/:id', requireAuth, requireAdmin, userController.updateUserById);

  /**
   * @route   DELETE /:id
   * @desc    Delete user by ID
   * @access  Admin only
   * @param   {string} id - User ID
   */
  router.delete(
    '/:id',
    requireAuth,
    requireAdmin,
    userController.deleteUserById,
  );

  /**
   * @route   PUT /:id/role
   * @desc    Update user role
   * @access  Admin only
   * @param   {string} id - User ID
   * @body    { role }
   */
  router.put(
    '/:id/role',
    requireAuth,
    requireAdmin,
    userController.updateUserRole,
  );

  /**
   * @route   PUT /:id/status
   * @desc    Update user status (active/inactive)
   * @access  Admin only
   * @param   {string} id - User ID
   * @body    { is_active }
   */
  router.put(
    '/:id/status',
    requireAuth,
    requireAdmin,
    userController.updateUserStatus,
  );

  // ========================================================================
  // USER ASSIGNMENT ROUTES (roles, groups, permissions)
  // ========================================================================

  /**
   * @route   PUT /:id/roles
   * @desc    Assign roles to a user
   * @access  Admin (requires 'users:manage' permission)
   * @param   {string} id - User ID
   * @body    { role_ids }
   */
  router.put(
    '/:id/roles',
    requireAuth,
    requirePermission('users:manage'),
    userAssignmentController.assignRolesToUser,
  );

  /**
   * @route   PUT /:id/groups
   * @desc    Assign groups to a user
   * @access  Admin (requires 'users:manage' permission)
   * @param   {string} id - User ID
   * @body    { group_ids }
   */
  router.put(
    '/:id/groups',
    requireAuth,
    requirePermission('users:manage'),
    userAssignmentController.assignGroupsToUser,
  );

  /**
   * @route   GET /:id/permissions
   * @desc    Get user's effective permissions
   * @access  Admin (requires 'users:read' permission) or Self
   * @param   {string} id - User ID
   */
  router.get(
    '/:id/permissions',
    requireAuth,
    requireAnyPermission(['users:read', 'users:manage']),
    userAssignmentController.getUserPermissions,
  );

  /**
   * @route   GET /:id/permissions/:permission
   * @desc    Check if user has specific permission
   * @access  Admin (requires 'users:read' permission) or Self
   * @param   {string} id - User ID
   * @param   {string} permission - Permission name
   */
  router.get(
    '/:id/permissions/:permission',
    requireAuth,
    requireAnyPermission(['users:read', 'users:manage']),
    userAssignmentController.checkUserPermission,
  );

  return router;
}
