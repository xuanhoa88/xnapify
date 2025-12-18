/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as rbacService from '../../services/admin/rbac.service';

// ========================================================================
// RBAC CONTROLLERS
// ========================================================================

/**
 * Assign roles to a user
 *
 * @route   PUT /api/users/:id/roles
 * @access  Admin (requires 'users:manage' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function assignRolesToUser(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { role_names } = req.body;

    // Validate input
    if (!Array.isArray(role_names)) {
      return http.sendValidationError(res, {
        role_names: 'Role names must be an array',
      });
    }

    // Get models from app context
    const models = req.app.get('models');

    // Assign roles
    const user = await rbacService.assignRolesToUser(id, role_names, models);

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

    return http.sendServerError(res, 'Failed to assign roles to user');
  }
}

/**
 * Get user roles
 *
 * @route   GET /api/users/:id/roles
 * @access  Admin (requires 'users:read' permission) or Self
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getUserRoles(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;

    const models = req.app.get('models');

    const user = await rbacService.getUserRoles(id, models);

    return http.sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        display_name: (user.profile && user.profile.display_name) || null,
      },
      roles:
        Array.isArray(user.roles) && user.roles.length > 0
          ? user.roles.map(role => role.name)
          : [],
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get user roles');
  }
}

/**
 * Assign groups to a user
 *
 * @route   PUT /api/users/:id/groups
 * @access  Admin (requires 'users:manage' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function assignGroupsToUser(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { group_ids } = req.body;

    // Validate input
    if (!Array.isArray(group_ids)) {
      return http.sendValidationError(res, {
        group_ids: 'Group IDs must be an array',
      });
    }

    // Get models from app context
    const models = req.app.get('models');

    // Assign groups
    const user = await rbacService.assignGroupsToUser(id, group_ids, models);

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

    return http.sendServerError(res, 'Failed to assign groups to user');
  }
}

/**
 * Get user groups
 *
 * @route   GET /api/users/:id/groups
 * @access  Admin (requires 'users:read' permission) or Self
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getUserGroups(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const models = req.app.get('models');

    const user = await rbacService.getUserGroups(id, models);

    return http.sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        display_name: (user.profile && user.profile.display_name) || null,
      },
      groups: user.groups,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get user groups');
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

    // Get models from app context
    const models = req.app.get('models');

    // Get user permissions
    const permissions = await rbacService.getUserPermissions(id, models);

    return http.sendSuccess(res, { permissions });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    return http.sendServerError(res, 'Failed to get user permissions');
  }
}

/**
 * Check if user has specific permission
 *
 * @route   GET /api/users/:id/permissions/:permission
 * @access  Admin (requires 'users:read' permission) or Self
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function checkUserPermission(req, res) {
  const http = req.app.get('http');
  try {
    const { id, permission } = req.params;

    // Get models from app context
    const models = req.app.get('models');

    // Check permission
    const hasPermission = await rbacService.userHasPermission(
      id,
      permission,
      models,
    );

    return http.sendSuccess(res, {
      user_id: id,
      permission,
      hasPermission,
    });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    return http.sendServerError(res, 'Failed to check user permission');
  }
}

/**
 * Remove role from user
 *
 * @route   DELETE /api/users/:id/roles/:role_id
 * @access  Admin (requires 'users:manage' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function removeRoleFromUser(req, res) {
  const http = req.app.get('http');
  try {
    const { id, role_id } = req.params;

    // Get models from app context
    const models = req.app.get('models');

    await rbacService.removeRoleFromUser(id, role_id, models);

    return http.sendSuccess(res, {
      message: `Role '${role_id}' removed from user successfully`,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to remove role from user');
  }
}

/**
 * Remove group from user
 *
 * @route   DELETE /api/users/:id/groups/:group_id
 * @access  Admin (requires 'users:manage' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function removeGroupFromUser(req, res) {
  const http = req.app.get('http');
  try {
    const { id, group_id } = req.params;

    // Get models from app context
    const models = req.app.get('models');

    await rbacService.removeGroupFromUser(id, group_id, models);

    return http.sendSuccess(res, {
      message: `Group '${group_id}' removed from user successfully`,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to remove group from user');
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

    // Get models from app context
    const models = req.app.get('models');

    // Get group permissions
    const result = await rbacService.getGroupPermissions(id, models);

    return http.sendSuccess(res, result);
  } catch (error) {
    if (error.name === 'GroupNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    return http.sendServerError(res, 'Failed to get group permissions');
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

    // Get models from app context
    const models = req.app.get('models');

    // Get group roles
    const result = await rbacService.getGroupRoles(id, models);

    return http.sendSuccess(res, result);
  } catch (error) {
    if (error.name === 'GroupNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    return http.sendServerError(res, 'Failed to get group roles');
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

    // Validate input
    if (!Array.isArray(role_names)) {
      return http.sendValidationError(res, {
        role_names: 'Role names must be an array',
      });
    }

    // Get models from app context
    const models = req.app.get('models');

    const updatedGroup = await rbacService.assignRolesToGroup(
      id,
      role_names,
      models,
    );

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
    return http.sendServerError(res, 'Failed to assign roles to group');
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

    const models = req.app.get('models');

    await rbacService.addRoleToGroup(id, role_id, models);

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
    return http.sendServerError(res, 'Failed to add role to group');
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

    const models = req.app.get('models');

    await rbacService.removeRoleFromGroup(id, role_id, models);

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
    return http.sendServerError(res, 'Failed to remove role from group');
  }
}

// ========================================================================
// ROLE-PERMISSION CONTROLLERS
// ========================================================================

/**
 * Assign permissions to a role
 *
 * @route   PUT /api/admin/roles/:id/permissions
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

    const models = req.app.get('models');

    const role = await rbacService.assignPermissionsToRole(
      id,
      permission_ids,
      models,
    );

    return http.sendSuccess(res, { role });
  } catch (error) {
    if (error.name === 'RoleNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    if (error.name === 'PermissionNotFoundError') {
      return http.sendValidationError(res, {
        permission_ids: error.message,
      });
    }
    return http.sendServerError(res, 'Failed to assign permissions to role');
  }
}

/**
 * Add a single permission to a role
 *
 * @route   POST /api/admin/roles/:id/permissions/:permission_id
 * @access  Admin (requires 'roles:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function addPermissionToRole(req, res) {
  const http = req.app.get('http');
  try {
    const { id, permission_id } = req.params;

    const models = req.app.get('models');

    await rbacService.addPermissionToRole(id, permission_id, models);

    return http.sendSuccess(res, {
      message: 'Permission added to role successfully',
    });
  } catch (error) {
    if (error.name === 'RoleNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    if (error.name === 'PermissionNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    return http.sendServerError(res, 'Failed to add permission to role');
  }
}

/**
 * Remove a permission from a role
 *
 * @route   DELETE /api/admin/roles/:id/permissions/:permission_id
 * @access  Admin (requires 'roles:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function removePermissionFromRole(req, res) {
  const http = req.app.get('http');
  try {
    const { id, permission_id } = req.params;

    const models = req.app.get('models');

    await rbacService.removePermissionFromRole(id, permission_id, models);

    return http.sendSuccess(res, {
      message: 'Permission removed from role successfully',
    });
  } catch (error) {
    if (error.name === 'RoleNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    if (error.name === 'PermissionNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    return http.sendServerError(res, 'Failed to remove permission from role');
  }
}
