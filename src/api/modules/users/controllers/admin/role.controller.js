/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as roleService from '../../services/admin/role.service';

// ========================================================================
// ROLE MANAGEMENT CONTROLLERS
// ========================================================================

/**
 * Create a new role
 *
 * @route   POST /api/admin/roles
 * @access  Admin (requires 'roles:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function createRole(req, res) {
  const http = req.app.get('http');
  try {
    const { name, description, permissions } = req.body;

    // Validate input
    if (!name) {
      return http.sendValidationError(res, {
        name: 'Role name is required',
      });
    }

    // Get models from app context
    const models = req.app.get('models');

    // Create role
    let role = await roleService.createRole(
      { name, description, permissions },
      models,
    );

    return http.sendSuccess(res, { role }, 201);
  } catch (error) {
    if (error.name === 'RoleAlreadyExistsError') {
      return http.sendError(res, error.message, 409);
    }

    if (error.name === 'PermissionNotFoundError') {
      return http.sendValidationError(res, {
        permissions: error.message,
      });
    }

    return http.sendServerError(res, 'Failed to create role');
  }
}

/**
 * Get all roles with pagination
 *
 * @route   GET /api/admin/roles
 * @access  Admin (requires 'roles:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getRoles(req, res) {
  const http = req.app.get('http');
  try {
    const { page = 1, limit = 10, search = '' } = req.query;

    // Get models from app context
    const models = req.app.get('models');

    // Get roles
    const result = await roleService.getRoles({ page, limit, search }, models);

    return http.sendSuccess(res, result);
  } catch (error) {
    return http.sendServerError(res, 'Failed to get roles');
  }
}

/**
 * Get role by ID
 *
 * @route   GET /api/admin/roles/:id
 * @access  Admin (requires 'roles:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getRoleById(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;

    // Get models from app context
    const models = req.app.get('models');

    const role = await roleService.getRoleById(id, models);

    return http.sendSuccess(res, { role });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get role');
  }
}

/**
 * Update role by ID
 *
 * @route   PUT /api/admin/roles/:id
 * @access  Admin (requires 'roles:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updateRole(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    // Get models from app context
    const models = req.app.get('models');

    const role = await roleService.updateRole(
      id,
      { name, description, permissions },
      models,
    );

    return http.sendSuccess(res, { role });
  } catch (error) {
    if (error.name === 'RoleAlreadyExistsError') {
      return http.sendError(res, error.message, 409);
    }

    if (error.name === 'PermissionNotFoundError') {
      return http.sendValidationError(res, {
        permissions: error.message,
      });
    }

    return http.sendServerError(res, 'Failed to update role');
  }
}

/**
 * Delete role by ID
 *
 * @route   DELETE /api/admin/roles/:id
 * @access  Admin (requires 'roles:delete' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function deleteRole(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;

    // Get models from app context
    const models = req.app.get('models');

    await roleService.deleteRole(id, models);

    return http.sendSuccess(res, {
      message: `Role deleted successfully`,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete role');
  }
}

// ========================================================================
// RBAC SYSTEM CONTROLLERS
// ========================================================================

/**
 * Initialize roles, permissions and groups
 *
 * @route   POST /api/admin/roles/initialize
 * @access  Admin (requires 'system:admin' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function initializeDefaults(req, res) {
  const http = req.app.get('http');
  try {
    // Get models from app context
    const models = req.app.get('models');

    // Initialize RBAC
    const result = await roleService.initializeDefaultRoles(models);

    return http.sendSuccess(res, {
      message: 'RBAC system initialized successfully',
      ...result,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to initialize RBAC system');
  }
}
