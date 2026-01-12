/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '../../../../../shared/validator';
import {
  createPermissionFormSchema,
  updatePermissionFormSchema,
  bulkUpdatePermissionStatusFormSchema,
  bulkDeletePermissionFormSchema,
} from '../../../../../shared/validator/features/admin';
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

    // Validate with Zod schema
    const [isValid, errors] = validateForm(createPermissionFormSchema, {
      resource: resource || '',
      action: action || '',
      description: description || '',
      is_active: is_active !== false,
    });

    if (!isValid) {
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
    const { page, limit } = http.getPagination(req);
    const { search = '', status = '' } = req.query;

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
    const { page, limit } = http.getPagination(req);
    const { search = '' } = req.query;
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

    // Validate with Zod schema
    const [isValid, errors] = validateForm(updatePermissionFormSchema, {
      resource: resource || '',
      action: action || '',
      description: description || '',
      is_active: is_active !== false,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

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
 * Bulk update permission status
 *
 * @route   PATCH /api/admin/permissions/status
 * @access  Admin (requires 'permissions:update' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function bulkUpdateStatus(req, res) {
  const http = req.app.get('http');
  try {
    const { ids, state } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(
      bulkUpdatePermissionStatusFormSchema,
      {
        ids,
        state,
      },
    );

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Get models and webhook from app context
    const models = req.app.get('models');
    const webhook = req.app.get('webhook');

    // Bulk update permissions (activity logged in service)
    const permissions = await permissionService.bulkUpdateStatus(
      ids,
      state === 'active',
      {
        models,
        webhook,
        actorId: req.user.id,
      },
    );

    return http.sendSuccess(res, {
      permissions,
      updated: permissions.length,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to bulk update permissions');
  }
}

/**
 * Delete one or more permissions
 *
 * @route   DELETE /api/admin/permissions
 * @access  Admin (requires 'permissions:delete' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function deletePermissions(req, res) {
  const http = req.app.get('http');
  try {
    const { ids } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(bulkDeletePermissionFormSchema, {
      ids,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Get models and webhook from app context
    const models = req.app.get('models');
    const webhook = req.app.get('webhook');

    // Delete permissions (activity logged in service)
    const result = await permissionService.bulkDelete(ids, {
      models,
      webhook,
      actorId: req.user.id,
    });

    return http.sendSuccess(res, {
      message: `Deleted ${result.deleted} permission(s)`,
      deleted: result.deleted,
      deletedIds: result.deletedIds,
      protectedIds: result.protectedIds,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete permissions');
  }
}
