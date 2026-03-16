/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '@shared/validator';

import {
  assignRolesToUserFormSchema,
  assignGroupsToUserFormSchema,
  assignRolesToGroupFormSchema,
  manageRolePermissionsFormSchema,
} from '../../../validator/admin';
import * as rbacService from '../../services/admin/rbac.service';
import * as roleService from '../../services/admin/role.service';

// ========================================================================
// RBAC CONTROLLERS
// ========================================================================

/**
 * Initialize roles, permissions and groups
 *
 * @route   POST /api/admin/roles/initialize
 * @access  Admin (requires '*:*' permission - super admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function initializeDefaults(req, res) {
  const http = req.app.get('http');
  try {
    const auth = req.app.get('auth');

    // Initialize RBAC
    const result = await rbacService.initializeDefault({
      models: req.app.get('models'),
      adminRoleName: auth.ADMIN_ROLE,
      defaultRoleName: auth.DEFAULT_ROLE,
      moderatorRoleName: auth.MODERATOR_ROLE,
      adminGroupName: auth.ADMIN_GROUP,
      defaultGroupName: auth.DEFAULT_GROUP,
      defaultResources: auth.DEFAULT_RESOURCES,
      defaultActions: auth.DEFAULT_ACTIONS,
    });

    return http.sendSuccess(res, {
      message: 'RBAC system initialized successfully',
      ...result,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to initialize RBAC system', error);
  }
}

/**
 * Assign roles to a user
 *
 * @route   PUT /api/users/:id/roles
 * @access  Admin (requires 'users:update' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function assignRolesToUser(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { role_names } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(assignRolesToUserFormSchema, {
      role_names,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Prevent user from changing their own roles
    if (req.user.id === id) {
      return http.sendError(res, 'Cannot change your own roles', 400);
    }

    // Assign roles
    const user = await rbacService.assignRolesToUser(id, role_names, {
      models: req.app.get('models'),
      hook: req.app.get('hook'),
      actorId: req.user.id,
    });

    return http.sendSuccess(res, { user });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    if (error.message.includes('roles not found')) {
      return http.sendValidationError(res, {
        role_names: error.message,
      });
    }

    return http.sendServerError(res, 'Failed to assign roles to user', error);
  }
}

/**
 * Assign groups to a user
 *
 * @route   PUT /api/users/:id/groups
 * @access  Admin (requires 'users:update' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function assignGroupsToUser(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { group_ids } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(assignGroupsToUserFormSchema, {
      group_ids,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Prevent user from changing their own groups
    if (req.user.id === id) {
      return http.sendError(res, 'Cannot change your own groups', 400);
    }

    // Assign groups
    const user = await rbacService.assignGroupsToUser(id, group_ids, {
      models: req.app.get('models'),
      hook: req.app.get('hook'),
      actorId: req.user.id,
    });

    return http.sendSuccess(res, { user });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    if (error.name === 'GroupNotFoundError') {
      return http.sendValidationError(res, {
        group_ids: error.message,
      });
    }

    return http.sendServerError(res, 'Failed to assign groups to user', error);
  }
}

/**
 * Get user's effective permissions
 *
 * @route   GET /api/users/:id/permissions
 * @access  Admin (requires 'users:read' permission) or Self
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getUserPermissions(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;

    // Get user permissions
    const auth = req.app.get('auth');
    const permissions = await rbacService.getUserPermissions(id, {
      models: req.app.get('models'),
      defaultResources: auth.DEFAULT_RESOURCES,
      defaultActions: auth.DEFAULT_ACTIONS,
      cache: req.app.get('cache'),
    });

    return http.sendSuccess(res, { permissions });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    return http.sendServerError(res, 'Failed to get user permissions', error);
  }
}

/**
 * Check if user has specific permission
 *
 * @route   GET /api/users/:id/permissions/:resource/:action?
 * @access  Admin (requires 'users:read' permission) or Self
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function checkUserPermission(req, res) {
  const http = req.app.get('http');
  try {
    const { id, resource, action } = req.params;

    // Build permission name based on provided params
    let permissionName = resource;
    if (action) {
      permissionName += `:${action}`;
    }

    // Check permission
    const auth = req.app.get('auth');
    const hasPermission = await rbacService.userHasPermission(
      id,
      permissionName,
      {
        models: req.app.get('models'),
        cache: req.app.get('cache'),
        defaultResources: auth.DEFAULT_RESOURCES,
        defaultActions: auth.DEFAULT_ACTIONS,
      },
    );

    return http.sendSuccess(res, {
      user_id: id,
      permission: permissionName,
      resource,
      action: action || null,
      hasPermission,
    });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    return http.sendServerError(res, 'Failed to check user permission', error);
  }
}

/**
 * Remove role from user
 *
 * @route   DELETE /api/users/:id/roles/:role_id
 * @access  Admin (requires 'users:update' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function removeRoleFromUser(req, res) {
  const http = req.app.get('http');
  try {
    const { id, role_id } = req.params;

    // Prevent user from removing their own roles
    if (req.user.id === id) {
      return http.sendError(res, 'Cannot remove your own roles', 400);
    }

    await rbacService.removeRoleFromUser(id, role_id, {
      models: req.app.get('models'),
      hook: req.app.get('hook'),
      actorId: req.user.id,
    });

    return http.sendSuccess(res, {
      message: `Role '${role_id}' removed from user successfully`,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to remove role from user', error);
  }
}

/**
 * Remove group from user
 *
 * @route   DELETE /api/users/:id/groups/:group_id
 * @access  Admin (requires 'users:update' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function removeGroupFromUser(req, res) {
  const http = req.app.get('http');
  try {
    const { id, group_id } = req.params;

    // Prevent user from removing their own groups
    if (req.user.id === id) {
      return http.sendError(res, 'Cannot remove your own groups', 400);
    }

    await rbacService.removeGroupFromUser(id, group_id, {
      models: req.app.get('models'),
      hook: req.app.get('hook'),
      actorId: req.user.id,
    });

    return http.sendSuccess(res, {
      message: `Group '${group_id}' removed from user successfully`,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to remove group from user', error);
  }
}

// ========================================================================
// GROUP-ROLE CONTROLLERS
// ========================================================================

/**
 * Get group's effective permissions
 *
 * @route   GET /api/admin/groups/:id/permissions
 * @access  Admin (requires 'groups:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getGroupPermissions(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;

    const auth = req.app.get('auth');

    // Get group permissions
    const result = await rbacService.getGroupPermissions(id, {
      models: req.app.get('models'),
      defaultResources: auth.DEFAULT_RESOURCES,
      defaultActions: auth.DEFAULT_ACTIONS,
    });

    return http.sendSuccess(res, result);
  } catch (error) {
    if (error.name === 'GroupNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    return http.sendServerError(res, 'Failed to get group permissions', error);
  }
}

/**
 * Get group's roles
 *
 * @route   GET /api/admin/groups/:id/roles
 * @access  Admin (requires 'groups:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getGroupRoles(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;

    // Get group roles
    const result = await rbacService.getGroupRoles(id, {
      models: req.app.get('models'),
    });

    return http.sendSuccess(res, result);
  } catch (error) {
    if (error.name === 'GroupNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    return http.sendServerError(res, 'Failed to get group roles', error);
  }
}

/**
 * Assign roles to a group
 *
 * @route   PUT /api/admin/groups/:id/roles
 * @access  Admin (requires 'groups:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function assignRolesToGroup(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { role_names } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(assignRolesToGroupFormSchema, {
      role_names,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Prevent user from modifying groups they belong to
    const userGroups = req.user.groups || [];
    if (userGroups.some(g => g === id)) {
      return http.sendError(
        res,
        'Cannot modify roles for a group you belong to',
        400,
      );
    }

    const updatedGroup = await rbacService.assignRolesToGroup(id, role_names, {
      models: req.app.get('models'),
      hook: req.app.get('hook'),
      actorId: req.user.id,
    });

    return http.sendSuccess(res, { group: updatedGroup });
  } catch (error) {
    if (error.name === 'GroupNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    if (error.name === 'RoleNotFoundError') {
      return http.sendValidationError(res, {
        role_names: error.message,
      });
    }
    return http.sendServerError(res, 'Failed to assign roles to group', error);
  }
}

/**
 * Add a single role to a group
 *
 * @route   POST /api/admin/groups/:id/roles/:role_id
 * @access  Admin (requires 'groups:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function addRoleToGroup(req, res) {
  const http = req.app.get('http');
  try {
    const { id, role_id } = req.params;

    // Prevent user from modifying groups they belong to
    const userGroups = req.user.groups || [];
    if (userGroups.some(g => g === id)) {
      return http.sendError(
        res,
        'Cannot add roles to a group you belong to',
        400,
      );
    }

    await rbacService.addRoleToGroup(id, role_id, {
      models: req.app.get('models'),
      hook: req.app.get('hook'),
      actorId: req.user.id,
    });

    return http.sendSuccess(res, {
      message: `Role added to group successfully`,
    });
  } catch (error) {
    if (error.name === 'GroupNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    if (error.name === 'RoleNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    return http.sendServerError(res, 'Failed to add role to group', error);
  }
}

/**
 * Remove a role from a group
 *
 * @route   DELETE /api/admin/groups/:id/roles/:role_id
 * @access  Admin (requires 'groups:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function removeRoleFromGroup(req, res) {
  const http = req.app.get('http');
  try {
    const { id, role_id } = req.params;

    // Prevent user from modifying groups they belong to
    const userGroups = req.user.groups || [];
    if (userGroups.some(g => g === id)) {
      return http.sendError(
        res,
        'Cannot remove roles from a group you belong to',
        400,
      );
    }

    await rbacService.removeRoleFromGroup(id, role_id, {
      models: req.app.get('models'),
      hook: req.app.get('hook'),
      actorId: req.user.id,
    });

    return http.sendSuccess(res, {
      message: `Role removed from group successfully`,
    });
  } catch (error) {
    if (error.name === 'GroupNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    if (error.name === 'RoleNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    return http.sendServerError(res, 'Failed to remove role from group', error);
  }
}

// ========================================================================
// ROLE-PERMISSION CONTROLLERS
// ========================================================================

/**
 * Get role's permissions
 *
 * @route   GET /api/admin/roles/:id/permissions
 * @access  Admin (requires 'roles:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getRolePermissions(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;

    const auth = req.app.get('auth');

    // Get role permissions
    const permissions = await rbacService.getRolePermissions(id, {
      models: req.app.get('models'),
      defaultActions: auth.DEFAULT_ACTIONS,
      defaultResources: auth.DEFAULT_RESOURCES,
    });

    return http.sendSuccess(res, { permissions });
  } catch (error) {
    if (error.name === 'RoleNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    return http.sendServerError(res, 'Failed to get role permissions', error);
  }
}

/**
 * Manage role permissions (add/remove/replace)
 *
 * @route   PUT /api/admin/roles/:id/permissions
 * @access  Admin (requires 'roles:write' permission)
 * @body    { action: 'add'|'remove'|'replace', permissions: ["resource:action", ...] }
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function manageRolePermissions(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { action, permissions } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(manageRolePermissionsFormSchema, {
      action,
      permissions,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    const models = req.app.get('models');
    const auth = req.app.get('auth');

    const role = await roleService.getRoleById(id, {
      models,
      defaultResources: auth.DEFAULT_RESOURCES,
      defaultActions: auth.DEFAULT_ACTIONS,
    });

    // Prevent user from modifying permissions for roles they have
    const userRoles = req.user.roles || [];
    if (userRoles.some(r => r === role.name)) {
      return http.sendError(
        res,
        'Cannot modify permissions for a role you have',
        400,
      );
    }
    const updatedRole = await rbacService.manageRolePermissions(
      role.name,
      permissions,
      {
        models,
        hook: req.app.get('hook'),
        actorId: req.user.id,
      },
      action,
    );

    return http.sendSuccess(res, { role: updatedRole });
  } catch (error) {
    if (error.name === 'RoleNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    if (error.name === 'ValidationError') {
      return http.sendValidationError(res, {
        action: error.message,
      });
    }
    if (error.name === 'PermissionNotFoundError') {
      return http.sendValidationError(res, {
        permissions: error.message,
      });
    }
    return http.sendServerError(
      res,
      'Failed to manage role permissions',
      error,
    );
  }
}
