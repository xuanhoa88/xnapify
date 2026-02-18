/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as userController from '../../controllers/admin/user.controller';
import * as rbacController from '../../controllers/admin/rbac.controller';

/**
 * User Administration Routes
 *
 * Handles administrative user management operations including user listing,
 * viewing, updating, deleting, role/group assignments, and status management.
 *
 * All routes require admin privileges.
 *
 * @param {Object} app - Express application instance
 * @param {Object} userMiddlewares - Authentication middlewares
 * @param {Object} options - Options
 * @param {Function} options.Router - Express Router constructor
 * @returns {Router} Express router with user admin routes
 */
export default function userRoutes(app, userMiddlewares, { Router }) {
  const { requirePermission, requireAnyPermission } = userMiddlewares;
  const router = Router();

  // ========================================================================
  // USER CRUD ROUTES
  // ========================================================================

  /**
   * @route   POST /
   * @desc    Create new user
   * @access  Admin only
   * @body    { email, password, display_name, ... }
   */
  router.post(
    '/',
    requirePermission('users:create'),
    userController.createUser,
  );

  /**
   * @route   GET /list
   * @desc    Get paginated list of all users
   * @access  Admin only
   * @query   { page, limit, search, role, status }
   */
  router.get(
    '/list',
    requirePermission('users:read'),
    userController.getUserList,
  );

  /**
   * @route   PATCH /status
   * @desc    Bulk update user status
   * @access  Admin only
   * @body    { ids: string[], state: 'active' | 'inactive' }
   */
  router.patch(
    '/status',
    requirePermission('users:update'),
    userController.bulkUpdateStatus,
  );

  /**
   * @route   DELETE /
   * @desc    Bulk delete users
   * @access  Admin only
   * @body    { ids: string[] }
   */
  router.delete(
    '/',
    requirePermission('users:delete'),
    userController.bulkDelete,
  );

  /**
   * @route   GET /:id
   * @desc    Get specific user by ID
   * @access  Admin only
   * @param   {string} id - User ID
   */
  router.get(
    '/:id',
    requirePermission('users:read'),
    userController.getUserById,
  );

  /**
   * @route   PUT /:id
   * @desc    Update user by ID
   * @access  Admin only
   * @param   {string} id - User ID
   * @body    { email, display_name, is_active, email_confirmed }
   */
  router.put(
    '/:id',
    requirePermission('users:update'),
    userController.updateUserById,
  );

  // ========================================================================
  // USER ASSIGNMENT ROUTES (roles, groups, permissions)
  // ========================================================================

  /**
   * @route   PUT /:id/roles
   * @desc    Assign roles to a user
   * @access  Admin (requires 'users:update' permission)
   * @param   {string} id - User ID
   * @body    { role_names }
   */
  router.put(
    '/:id/roles',
    requirePermission('users:update'),
    rbacController.assignRolesToUser,
  );

  /**
   * @route   PUT /:id/groups
   * @desc    Assign groups to a user
   * @access  Admin (requires 'users:update' permission)
   * @param   {string} id - User ID
   * @body    { group_ids }
   */
  router.put(
    '/:id/groups',
    requirePermission('users:update'),
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
    requireAnyPermission(['users:read', 'users:update']),
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
    requireAnyPermission(['users:read', 'users:update']),
    rbacController.checkUserPermission,
  );

  // ========================================================================
  // API KEY ROUTES
  // ========================================================================

  /**
   * @route   GET /:id/api-keys
   * @desc    List API keys for a user
   * @access  Admin only
   * @param   {string} id - User ID
   */
  router.get(
    '/:id/api-keys',
    requirePermission('apiKeys:read'),
    userController.listApiKeys,
  );

  /**
   * @route   POST /:id/api-keys
   * @desc    Create a new API key for a user
   * @access  Admin only
   * @param   {string} id - User ID
   * @body    { name, scopes? }
   */
  router.post(
    '/:id/api-keys',
    requirePermission('apiKeys:create'),
    userController.createApiKey,
  );

  /**
   * @route   DELETE /:id/api-keys/:keyId
   * @desc    Revoke an API key
   * @access  Admin only
   * @param   {string} id - User ID
   * @param   {string} keyId - API Key ID
   */
  router.delete(
    '/:id/api-keys/:keyId',
    requirePermission('apiKeys:delete'),
    userController.revokeApiKey,
  );

  return router;
}
