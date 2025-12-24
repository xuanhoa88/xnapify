/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as permissionService from '../../services/admin/permission.service';

// ========================================================================
// PERMISSION MANAGEMENT CONTROLLERS
// ========================================================================

/**
 * Create a new permission
 *
 * @route   POST /api/admin/permissions
 * @access  Admin (requires 'permissions:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function createPermission(req, res) {
  const http = req.app.get('http');
  try {
    const { resource, action, description, is_active } = req.body;

    // Validate input
    const errors = {};
    if (!resource) errors.resource = 'RESOURCE_REQUIRED';
    if (!action) errors.action = 'ACTION_REQUIRED';

    if (Object.keys(errors).length > 0) {
      return http.sendValidationError(res, errors);
    }

    // Get models from app context
    const models = req.app.get('models');

    // Create permission
    const permission = await permissionService.createPermission(
      { resource, action, description, is_active },
      models,
    );

    return http.sendSuccess(res, { permission }, 201);
  } catch (error) {
    if (error.name === 'PermissionAlreadyExistsError') {
      return http.sendError(res, error.message, 409);
    }

    return http.sendServerError(res, 'Failed to create permission');
  }
}

/**
 * Get all permissions with pagination
 *
 * @route   GET /api/admin/permissions
 * @access  Admin (requires 'permissions:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getPermissions(req, res) {
  const http = req.app.get('http');
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;

    // Get models from app context
    const models = req.app.get('models');

    // Get permissions
    const result = await permissionService.getPermissions(
      { page, limit, search, status },
      models,
    );

    return http.sendSuccess(res, result);
  } catch (error) {
    return http.sendServerError(res, 'Failed to get permissions');
  }
}

/**
 * Get permissions by resource name
 *
 * @route   GET /api/admin/permissions/resources/:resource
 * @access  Admin (requires 'permissions:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getPermissionsByResource(req, res) {
  const http = req.app.get('http');
  try {
    const { resource } = req.params;
    const { search, page = 1, limit = 10 } = req.query;
    const models = req.app.get('models');
    const result = await permissionService.getPermissionsByResource(
      resource,
      { search, page, limit },
      models,
    );

    return http.sendSuccess(res, result);
  } catch (error) {
    return http.sendServerError(res, 'Failed to get permissions by resource');
  }
}

/**
 * Get permission by ID
 *
 * @route   GET /api/admin/permissions/:id
 * @access  Admin (requires 'permissions:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getPermissionById(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const models = req.app.get('models');

    const permission = await permissionService.getPermissionById(id, models);

    return http.sendSuccess(res, { permission });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get permission');
  }
}

/**
 * Update permission by ID
 *
 * @route   PUT /api/admin/permissions/:id
 * @access  Admin (requires 'permissions:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updatePermission(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { resource, action, description, is_active } = req.body;
    const models = req.app.get('models');

    const updatedPermission = await permissionService.updatePermission(
      id,
      { resource, action, description, is_active },
      models,
    );

    return http.sendSuccess(res, { permission: updatedPermission });
  } catch (error) {
    if (error.name === 'PermissionAlreadyExistsError') {
      return http.sendError(res, error.message, 409);
    }

    return http.sendServerError(res, 'Failed to update permission');
  }
}

/**
 * Delete permission by ID
 *
 * @route   DELETE /api/admin/permissions/:id
 * @access  Admin (requires 'permissions:delete' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function deletePermission(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const models = req.app.get('models');

    const removedPermission = await permissionService.deletePermission(
      id,
      models,
    );

    return http.sendSuccess(res, {
      message: `Permission '${removedPermission.name}' deleted successfully`,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete permission');
  }
}
