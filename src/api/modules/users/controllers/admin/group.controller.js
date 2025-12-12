/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as groupService from '../../services/admin/group.service';
import { ADMIN_ROLE, STAFF_ROLE, MODERATOR_ROLE } from '../../constants/roles';

// ========================================================================
// GROUP MANAGEMENT CONTROLLERS
// ========================================================================

/**
 * Create a new group
 *
 * @route   POST /api/admin/groups
 * @access  Admin (requires 'groups:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function createGroup(req, res) {
  const http = req.app.get('http');
  try {
    const { name, description } = req.body;

    // Validate input
    if (!name) {
      return http.sendValidationError(res, {
        name: 'Group name is required',
      });
    }

    // Get models from app context
    const models = req.app.get('models');

    // Create group
    const group = await groupService.createGroup({ name, description }, models);

    return http.sendSuccess(res, { group }, 201);
  } catch (error) {
    if (error.name === 'GroupAlreadyExistsError') {
      return http.sendError(res, error.message, 409);
    }

    return http.sendServerError(res, 'Failed to create group');
  }
}

/**
 * Get all groups with pagination
 *
 * @route   GET /api/admin/groups
 * @access  Admin (requires 'groups:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getGroups(req, res) {
  const http = req.app.get('http');
  try {
    const { page = 1, limit = 10, search = '' } = req.query;

    // Get models from app context
    const models = req.app.get('models');

    // Get groups
    const result = await groupService.getGroups(
      { page, limit, search },
      models,
    );

    return http.sendSuccess(res, result);
  } catch (error) {
    console.error('getGroups error:', error);
    return http.sendServerError(res, 'Failed to get groups');
  }
}

/**
 * Get group by ID
 *
 * @route   GET /api/admin/groups/:id
 * @access  Admin (requires 'groups:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getGroupById(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const models = req.app.get('models');
    const { Group, Role, User } = models;

    const group = await Group.findByPk(id, {
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
        },
        {
          model: User,
          as: 'users',
          through: { attributes: [] },
          attributes: ['id', 'email', 'display_name'],
        },
      ],
    });

    if (!group) {
      return http.sendNotFound(res, 'Group not found');
    }

    return http.sendSuccess(res, { group });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get group');
  }
}

/**
 * Update group by ID
 *
 * @route   PUT /api/admin/groups/:id
 * @access  Admin (requires 'groups:write' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updateGroup(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const models = req.app.get('models');
    const { Group } = models;

    const group = await Group.findByPk(id);
    if (!group) {
      return http.sendNotFound(res, 'Group not found');
    }

    // Update group
    await group.update({
      name: name || group.name,
      description: description != null ? description : group.description,
    });

    return http.sendSuccess(res, { group });
  } catch (error) {
    if (error.name === 'GroupAlreadyExistsError') {
      return http.sendError(res, error.message, 409);
    }

    return http.sendServerError(res, 'Failed to update group');
  }
}

/**
 * Delete group by ID
 *
 * @route   DELETE /api/admin/groups/:id
 * @access  Admin (requires 'groups:delete' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function deleteGroup(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const models = req.app.get('models');
    const { Group } = models;

    const group = await Group.findByPk(id);
    if (!group) {
      return http.sendNotFound(res, 'Group not found');
    }

    // Prevent deletion of system groups
    if ([ADMIN_ROLE, STAFF_ROLE, MODERATOR_ROLE].includes(group.name)) {
      return http.sendError(res, 'Cannot delete system groups', 400);
    }

    await group.destroy();

    return http.sendSuccess(res, {
      message: `Group '${group.name}' deleted successfully`,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete group');
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
    const { role_ids } = req.body;

    // Validate input
    if (!Array.isArray(role_ids)) {
      return http.sendValidationError(res, {
        role_ids: 'Role IDs must be an array',
      });
    }

    const models = req.app.get('models');
    const { Group, Role } = models;

    const group = await Group.findByPk(id);
    if (!group) {
      return http.sendNotFound(res, 'Group not found');
    }

    // Verify all roles exist
    const roles = await Role.findAll({
      where: { id: role_ids },
    });

    if (roles.length !== role_ids.length) {
      return http.sendValidationError(res, {
        role_ids: 'One or more roles not found',
      });
    }

    // Set roles for group (replaces existing)
    await group.setRoles(roles);

    // Return group with roles
    const updatedGroup = await Group.findByPk(id, {
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
        },
      ],
    });

    return http.sendSuccess(res, { group: updatedGroup });
  } catch (error) {
    return http.sendServerError(res, 'Failed to assign roles to group');
  }
}

/**
 * Get group members
 *
 * @route   GET /api/admin/groups/:id/members
 * @access  Admin (requires 'groups:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getGroupMembers(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const models = req.app.get('models');
    const { Group, User } = models;

    const group = await Group.findByPk(id);
    if (!group) {
      return http.sendNotFound(res, 'Group not found');
    }

    const { count, rows: users } = await User.findAndCountAll({
      include: [
        {
          model: Group,
          as: 'groups',
          where: { id },
          through: { attributes: [] },
        },
      ],
      attributes: ['id', 'email', 'display_name', 'is_active', 'created_at'],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['display_name', 'ASC']],
    });

    return http.sendSuccess(res, {
      group: { id: group.id, name: group.name },
      members: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get group members');
  }
}
