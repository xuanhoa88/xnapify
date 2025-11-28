/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { roleService } from '../services';

// ========================================================================
// ROLE MANAGEMENT CONTROLLERS
// ========================================================================

/**
 * Create a new role
 *
 * @route   POST /api/users/roles
 * @access  Admin (requires 'roles:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function createRole(req, res) {
  const http = req.app.get('http');
  try {
    const { name, description } = req.body;

    // Validate input
    if (!name) {
      return http.sendValidationError(res, {
        name: 'Role name is required',
      });
    }

    // Get models from app context
    const models = req.app.get('models');

    // Create role
    const role = await roleService.createRole({ name, description }, models);

    return http.sendSuccess(res, { role }, 201);
  } catch (error) {
    if (error.message.includes('already exists')) {
      return http.sendError(res, error.message, 409);
    }

    return http.sendServerError(res, 'Failed to create role');
  }
}

/**
 * Get all roles with pagination
 *
 * @route   GET /api/users/roles
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
 * @route   GET /api/users/roles/:id
 * @access  Admin (requires 'roles:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getRoleById(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const models = req.app.get('models');
    const { Role, Permission } = models;

    const role = await Role.findByPk(id, {
      include: [
        {
          model: Permission,
          as: 'permissions',
          through: { attributes: [] },
        },
      ],
    });

    if (!role) {
      return http.sendNotFound(res, 'Role not found');
    }

    return http.sendSuccess(res, { role });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get role');
  }
}

/**
 * Update role by ID
 *
 * @route   PUT /api/users/roles/:id
 * @access  Admin (requires 'roles:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updateRole(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const models = req.app.get('models');
    const { Role } = models;

    const role = await Role.findByPk(id);
    if (!role) {
      return http.sendNotFound(res, 'Role not found');
    }

    // Update role
    await role.update({
      name: name || role.name,
      description: description != null ? description : role.description,
    });

    return http.sendSuccess(res, { role });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return http.sendError(res, error.message, 409);
    }

    return http.sendServerError(res, 'Failed to update role');
  }
}

/**
 * Delete role by ID
 *
 * @route   DELETE /api/users/roles/:id
 * @access  Admin (requires 'roles:delete' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function deleteRole(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const models = req.app.get('models');
    const { Role } = models;

    const role = await Role.findByPk(id);
    if (!role) {
      return http.sendNotFound(res, 'Role not found');
    }

    // Prevent deletion of system roles
    if (['admin', 'user'].includes(role.name)) {
      return http.sendError(res, 'Cannot delete system roles', 400);
    }

    await role.destroy();

    return http.sendSuccess(res, {
      message: `Role '${role.name}' deleted successfully`,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete role');
  }
}

/**
 * Assign permissions to a role
 *
 * @route   PUT /api/users/roles/:id/permissions
 * @access  Admin (requires 'roles:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function assignPermissionsToRole(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { permission_ids } = req.body;

    // Validate input
    if (!Array.isArray(permission_ids)) {
      return http.sendValidationError(res, {
        permission_ids: 'Permission IDs must be an array',
      });
    }

    // Get models from app context
    const models = req.app.get('models');

    // Assign permissions
    const role = await roleService.assignPermissionsToRole(
      id,
      permission_ids,
      models,
    );

    return http.sendSuccess(res, { role });
  } catch (error) {
    if (error.message === 'Role not found') {
      return http.sendNotFound(res, error.message);
    }

    if (error.message.includes('permissions not found')) {
      return http.sendValidationError(res, {
        permission_ids: error.message,
      });
    }

    return http.sendServerError(res, 'Failed to assign permissions to role');
  }
}
