/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '@shared/validator';

import {
  createRoleFormSchema,
  updateRoleFormSchema,
} from '../../../validator/admin';
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
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { name, description, permissions } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(createRoleFormSchema, {
      name: name || '',
      description: description || '',
      permissions: permissions || [],
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    const auth = container.resolve('auth');

    // Create role
    let role = await roleService.createRole(
      { name, description, permissions },
      {
        models: container.resolve('models'),
        hook: container.resolve('hook'),
        actorId: req.user.id,
        defaultResources: auth.DEFAULT_RESOURCES,
        defaultActions: auth.DEFAULT_ACTIONS,
      },
    );

    return http.sendSuccess(res, { role }, 201);
  } catch (error) {
    if (error.name === 'RoleAlreadyExistsError') {
      return http.sendValidationError(res, { name: error.message });
    }

    if (error.name === 'PermissionNotFoundError') {
      return http.sendValidationError(res, {
        permissions: error.message,
      });
    }

    return http.sendServerError(res, 'Failed to create role', error);
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
  const container = req.app.get('container');
  const http = container.resolve('http');
  const auth = container.resolve('auth');
  try {
    const { page, limit } = http.getPagination(req);
    const { search = '' } = req.query;

    // Get roles
    const result = await roleService.getRoles(
      {
        page,
        limit,
        search,
      },
      {
        models: container.resolve('models'),
        defaultResources: auth.DEFAULT_RESOURCES,
        defaultActions: auth.DEFAULT_ACTIONS,
      },
    );

    return http.sendSuccess(res, result);
  } catch (error) {
    return http.sendServerError(res, 'Failed to get roles', error);
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
  const container = req.app.get('container');
  const http = container.resolve('http');
  const auth = container.resolve('auth');
  try {
    const { id } = req.params;

    const role = await roleService.getRoleById(id, {
      models: container.resolve('models'),
      defaultResources: auth.DEFAULT_RESOURCES,
      defaultActions: auth.DEFAULT_ACTIONS,
    });

    return http.sendSuccess(res, { role });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get role', error);
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
  const container = req.app.get('container');
  const http = container.resolve('http');
  const auth = container.resolve('auth');
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(updateRoleFormSchema, {
      name: name || '',
      description: description || '',
      permissions: permissions || [],
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Get models from app context
    const models = container.resolve('models');

    // Fetch role first to check if user has this role
    const existingRole = await roleService.getRoleById(id, {
      models,
      defaultResources: auth.DEFAULT_RESOURCES,
      defaultActions: auth.DEFAULT_ACTIONS,
    });

    // Prevent user from modifying roles they have
    const userRoles = req.user.roles || [];
    if (userRoles.some(r => r === existingRole.name)) {
      return http.sendError(res, 'Cannot update a role you have', 400);
    }

    const role = await roleService.updateRole(
      id,
      { name, description, permissions },
      {
        models,
        hook: container.resolve('hook'),
        actorId: req.user.id,
        defaultResources: auth.DEFAULT_RESOURCES,
        defaultActions: auth.DEFAULT_ACTIONS,
        systemRoles: auth.SYSTEM_ROLES,
        adminRoleName: auth.ADMIN_ROLE,
        defaultRoleName: auth.DEFAULT_ROLE,
        moderatorRoleName: auth.MODERATOR_ROLE,
        adminGroupName: auth.ADMIN_GROUP,
        defaultGroupName: auth.DEFAULT_GROUP,
      },
    );

    return http.sendSuccess(res, { role });
  } catch (error) {
    if (error.name === 'RoleAlreadyExistsError') {
      return http.sendValidationError(res, { name: error.message });
    }

    if (error.name === 'PermissionNotFoundError') {
      return http.sendValidationError(res, {
        permissions: error.message,
      });
    }

    return http.sendServerError(res, 'Failed to update role', error);
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
  const container = req.app.get('container');
  const http = container.resolve('http');
  const auth = container.resolve('auth');
  try {
    const { id } = req.params;

    // Get models from app context
    const models = container.resolve('models');

    // Fetch role first to check if user has this role
    const existingRole = await roleService.getRoleById(id, {
      models,
      defaultResources: auth.DEFAULT_RESOURCES,
      defaultActions: auth.DEFAULT_ACTIONS,
    });

    // Prevent user from deleting roles they have
    const userRoles = req.user.roles || [];
    if (userRoles.some(r => r === existingRole.name)) {
      return http.sendError(res, 'Cannot delete a role you have', 400);
    }

    // Delete role (activities logged in service)
    await roleService.deleteRole(id, {
      models,
      hook: container.resolve('hook'),
      actorId: req.user.id,
      defaultResources: auth.DEFAULT_RESOURCES,
      defaultActions: auth.DEFAULT_ACTIONS,
      systemRoles: auth.SYSTEM_ROLES,
      adminRoleName: auth.ADMIN_ROLE,
      defaultRoleName: auth.DEFAULT_ROLE,
      moderatorRoleName: auth.MODERATOR_ROLE,
      adminGroupName: auth.ADMIN_GROUP,
      defaultGroupName: auth.DEFAULT_GROUP,
    });

    return http.sendSuccess(res, {
      message: `Role deleted successfully`,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete role', error);
  }
}

/**
 * Get users assigned to a role
 *
 * @route   GET /api/admin/roles/:id/users
 * @access  Admin (requires 'roles:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getRoleUsers(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { id } = req.params;
    const { page, limit } = http.getPagination(req);
    const { search = '' } = req.query;

    // Get models from app context
    const result = await roleService.getUsersWithRole(
      id,
      { page, limit, search },
      container.resolve('models'),
    );

    return http.sendSuccess(res, result);
  } catch (error) {
    if (error.name === 'RoleNotFoundError') {
      return http.sendError(res, error.message, 404);
    }
    return http.sendServerError(res, 'Failed to get role users', error);
  }
}

/**
 * Get groups assigned to a role
 *
 * @route   GET /api/admin/roles/:id/groups
 * @access  Admin (requires 'roles:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getRoleGroups(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { id } = req.params;
    const { page, limit } = http.getPagination(req);
    const { search = '' } = req.query;

    // Get models from app context
    const result = await roleService.getGroupsWithRole(
      id,
      { page, limit, search },
      container.resolve('models'),
    );

    return http.sendSuccess(res, result);
  } catch (error) {
    if (error.name === 'RoleNotFoundError') {
      return http.sendError(res, error.message, 404);
    }
    return http.sendServerError(res, 'Failed to get role groups', error);
  }
}
