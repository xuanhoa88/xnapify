/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as userController from '../../controllers/admin/user.controller';
import * as rbacController from '../../controllers/admin/rbac.controller';
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
 * @param {Object} userMiddlewares - Authentication middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with user admin routes
 */
export default function userRoutes(deps, userMiddlewares) {
  const { requireAdmin, requirePermission, requireAnyPermission } =
    userMiddlewares;
  const router = deps.Router();

  // ========================================================================
  // DASHBOARD ROUTES
  // ========================================================================

  /**
   * @route   GET /dashboard
   * @desc    Get dashboard statistics and recent activity
   * @access  Admin only
   */
  router.get('/dashboard', requireAdmin, dashboardController.getDashboard);

  // ========================================================================
  // USER CRUD ROUTES
  // ========================================================================

  /**
   * @route   GET /list
   * @desc    Get paginated list of all users
   * @access  Admin only
   * @query   { page, limit, search, role, status }
   */
  router.get('/list', requireAdmin, userController.getUserList);

  /**
   * @route   GET /generate-password
   * @desc    Generate a random secure password
   * @access  Admin only
   * @query   { length, includeSymbols }
   */
  router.get(
    '/generate-password',
    requireAdmin,
    userController.generateRandomPassword,
  );

  /**
   * @route   GET /stats
   * @desc    Get user statistics
   * @access  Admin only
   */
  router.get('/stats', requireAdmin, userController.getUserStats);

  /**
   * @route   GET /:id
   * @desc    Get specific user by ID
   * @access  Admin only
   * @param   {string} id - User ID
   */
  router.get('/:id', requireAdmin, userController.getUserById);

  /**
   * @route   PUT /:id
   * @desc    Update user by ID
   * @access  Admin only
   * @param   {string} id - User ID
   * @body    { email, display_name, is_active, email_confirmed }
   */
  router.put('/:id', requireAdmin, userController.updateUserById);

  /**
   * @route   DELETE /:id
   * @desc    Delete user by ID
   * @access  Admin only
   * @param   {string} id - User ID
   */
  router.delete('/:id', requireAdmin, userController.deleteUserById);

  /**
   * @route   PUT /:id/status
   * @desc    Update user status (active/inactive)
   * @access  Admin only
   * @param   {string} id - User ID
   * @body    { is_active }
   */
  router.put('/:id/status', requireAdmin, userController.updateUserStatus);

  // ========================================================================
  // USER ASSIGNMENT ROUTES (roles, groups, permissions)
  // ========================================================================

  /**
   * @route   GET /:id/roles
   * @desc    Get user's roles
   * @access  Admin (requires 'users:read' permission) or Self
   * @param   {string} id - User ID
   */
  router.get(
    '/:id/roles',
    requireAnyPermission(['users:read', 'users:manage']),
    rbacController.getUserRoles,
  );

  /**
   * @route   PUT /:id/roles
   * @desc    Assign roles to a user
   * @access  Admin (requires 'users:manage' permission)
   * @param   {string} id - User ID
   * @body    { role_names }
   */
  router.put(
    '/:id/roles',
    requirePermission('users:manage'),
    rbacController.assignRolesToUser,
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
    requirePermission('users:manage'),
    rbacController.assignGroupsToUser,
  );

  /**
   * @route   GET /:id/permissions
   * @desc    Get user's effective permissions
   * @access  Admin (requires 'users:read' permission) or Self
   * @param   {string} id - User ID
   */
  router.get(
    '/:id/permissions',
    requireAnyPermission(['users:read', 'users:manage']),
    rbacController.getUserPermissions,
  );

  /**
   * @route   GET /:id/permissions/:resource/:action?
   * @desc    Check if user has specific permission
   * @access  Admin (requires 'users:read' permission) or Self
   * @param   {string} id - User ID
   * @param   {string} resource - Permission resource (e.g., 'users')
   * @param   {string} [action] - Permission action (e.g., 'read') - optional
   */
  router.get(
    '/:id/permissions/:resource/:action?',
    requireAnyPermission(['users:read', 'users:manage']),
    rbacController.checkUserPermission,
  );

  return router;
}
