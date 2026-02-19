/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as permissionController from '../../controllers/admin/permission.controller';

/**
 * Permission Management Routes
 *
 * Handles permission CRUD operations and initialization.
 *
 * All routes require authentication and specific permissions.
 *
 * @param {Object} app - Express application instance
 * @param {Object} options - Options
 * @param {Function} options.Router - Express Router constructor
 * @returns {Router} Express router with permission routes
 */
export default function permissionRoutes(app, { Router }) {
  const { requirePermission } = app.get('auth').middlewares;
  const router = Router();

  /**
   * @route   POST /
   * @desc    Create a new permission
   * @access  Admin (requires 'permissions:create' permission)
   * @body    { name, resource, action, description }
   */
  router.post(
    '/',
    requirePermission('permissions:create'),
    permissionController.createPermission,
  );

  /**
   * @route   PATCH /status
   * @desc    Bulk update permission status
   * @access  Admin (requires 'permissions:update' permission)
   * @body    { ids: string[], is_active: boolean }
   */
  router.patch(
    '/status',
    requirePermission('permissions:update'),
    permissionController.bulkUpdateStatus,
  );

  /**
   * @route   DELETE /
   * @desc    Delete one or more permissions
   * @access  Admin (requires 'permissions:delete' permission)
   * @body    { id: string } or { ids: string[] }
   */
  router.delete(
    '/',
    requirePermission('permissions:delete'),
    permissionController.deletePermissions,
  );

  /**
   * @route   GET /resources/:resource
   * @desc    Get permissions by resource with pagination
   * @access  Admin (requires 'permissions:read' permission)
   * @query   { page, limit, search }
   */
  router.get(
    '/resources/:resource',
    requirePermission('permissions:read'),
    permissionController.getPermissionsByResource,
  );

  /**
   * @route   GET /
   * @desc    Get all permissions with pagination
   * @access  Admin (requires 'permissions:read' permission)
   * @query   { page, limit, search, resource, status }
   */
  router.get(
    '/',
    requirePermission('permissions:read'),
    permissionController.getPermissions,
  );

  /**
   * @route   GET /:id
   * @desc    Get permission by ID
   * @access  Admin (requires 'permissions:read' permission)
   */
  router.get(
    '/:id',
    requirePermission('permissions:read'),
    permissionController.getPermissionById,
  );

  /**
   * @route   PUT /:id
   * @desc    Update permission by ID
   * @access  Admin (requires 'permissions:update' permission)
   */
  router.put(
    '/:id',
    requirePermission('permissions:update'),
    permissionController.updatePermission,
  );

  return router;
}
