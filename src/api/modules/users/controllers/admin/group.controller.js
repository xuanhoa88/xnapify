/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as groupService from '../../services/admin/group.service';

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
    const { name, description, category, type, role_ids } = req.body;

    // Validate input
    if (!name) {
      return http.sendValidationError(res, {
        name: 'Group name is required',
      });
    }

    // Get models from app context
    const models = req.app.get('models');

    // Create group
    const group = await groupService.createGroup(
      { name, description, category, type, role_ids },
      models,
    );

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

    // Get models from app context
    const models = req.app.get('models');

    const group = await groupService.getGroupById(id, models);
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
    const { name, description, category, type, role_ids } = req.body;

    // Get models from app context
    const models = req.app.get('models');

    // Update group
    const group = await groupService.updateGroup(
      id,
      { name, description, category, type, role_ids },
      models,
    );

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

    // Get models from app context
    const models = req.app.get('models');

    await groupService.deleteGroup(id, models);

    return http.sendSuccess(res, {
      message: `Group deleted successfully`,
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

    // Get models from app context
    const models = req.app.get('models');

    // Return group with roles
    const updatedGroup = await groupService.assignRolesToGroup(
      id,
      role_ids,
      models,
    );

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

    // Get models from app context
    const models = req.app.get('models');

    const data = await groupService.getGroupMembers(
      id,
      { page, limit, offset },
      models,
    );

    return http.sendSuccess(res, data);
  } catch (error) {
    return http.sendServerError(res, 'Failed to get group members');
  }
}
