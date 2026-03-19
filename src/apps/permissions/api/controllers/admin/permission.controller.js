/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '@shared/validator';

import {
  createPermissionFormSchema,
  updatePermissionFormSchema,
  bulkUpdatePermissionStatusFormSchema,
  bulkDeletePermissionFormSchema,
} from '../../../validator/admin';
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
  const container = req.app.get('container');
  const http = container.resolve('http');
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

    // Create permission
    const permission = await permissionService.createPermission(
      { resource, action, description, is_active },
      {
        models: container.resolve('models'),
        hook: container.resolve('hook'),
        actorId: req.user.id,
      },
    );

    return http.sendSuccess(res, { permission }, 201);
  } catch (error) {
    if (error.name === 'PermissionAlreadyExistsError') {
      return http.sendValidationError(res, { resource: error.message });
    }

    return http.sendServerError(res, 'Failed to create permission', error);
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
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { page, limit } = http.getPagination(req);
    const { search = '', status = '' } = req.query;

    const auth = container.resolve('auth');

    // Get permissions
    const result = await permissionService.getPermissions(
      {
        page,
        limit,
        search,
        status,
      },
      {
        models: container.resolve('models'),
        defaultResources: auth.DEFAULT_RESOURCES,
        defaultActions: auth.DEFAULT_ACTIONS,
      },
    );

    return http.sendSuccess(res, result);
  } catch (error) {
    return http.sendServerError(res, 'Failed to get permissions', error);
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
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { resource } = req.params;
    const { page, limit } = http.getPagination(req);
    const { search = '' } = req.query;
    const result = await permissionService.getPermissionsByResource(
      resource,
      { search, page, limit },
      { models: container.resolve('models') },
    );

    return http.sendSuccess(res, result);
  } catch (error) {
    return http.sendServerError(
      res,
      'Failed to get permissions by resource',
      error,
    );
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
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { id } = req.params;
    const permission = await permissionService.getPermissionById(id, {
      models: container.resolve('models'),
    });

    return http.sendSuccess(res, { permission });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get permission', error);
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
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { id } = req.params;
    const { resource, action, description, is_active } = req.body;

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
      {
        models: container.resolve('models'),
        hook: container.resolve('hook'),
        actorId: req.user.id,
      },
    );

    return http.sendSuccess(res, { permission: updatedPermission });
  } catch (error) {
    if (error.name === 'PermissionAlreadyExistsError') {
      return http.sendValidationError(res, { resource: error.message });
    }

    return http.sendServerError(res, 'Failed to update permission', error);
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
  const container = req.app.get('container');
  const http = container.resolve('http');
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

    // Bulk update permissions (activities logged in service)
    const permissions = await permissionService.bulkUpdateStatus(
      ids,
      state === 'active',
      {
        models: container.resolve('models'),
        hook: container.resolve('hook'),
        actorId: req.user.id,
      },
    );

    return http.sendSuccess(res, {
      permissions,
      updated: permissions.length,
    });
  } catch (error) {
    return http.sendServerError(
      res,
      'Failed to bulk update permissions',
      error,
    );
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
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { ids } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(bulkDeletePermissionFormSchema, {
      ids,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Delete permissions (activities logged in service)
    const result = await permissionService.bulkDelete(ids, {
      models: container.resolve('models'),
      hook: container.resolve('hook'),
      actorId: req.user.id,
      systemPermissions: container.resolve('auth').SYSTEM_PERMISSIONS,
    });

    return http.sendSuccess(res, {
      message: `Deleted ${result.deleted} permission(s)`,
      deleted: result.deleted,
      deletedIds: result.deletedIds,
      protectedIds: result.protectedIds,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete permissions', error);
  }
}
