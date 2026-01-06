/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '../../../../../shared/validator';
import {
  createGroupFormSchema,
  updateGroupFormSchema,
} from '../../../../../shared/validator/features/admin';
import { DEFAULT_ROLE } from '../../constants/rbac';
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
    const { name, description, category, type, roles } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(createGroupFormSchema, {
      name: name || '',
      description: description || '',
      category: category || '',
      type: type || '',
      roles: roles || [],
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Get models from app context
    const models = req.app.get('models');

    // Create group
    const group = await groupService.createGroup(
      { name, description, category, type, roles },
      models,
    );

    return http.sendSuccess(
      res,
      {
        group: {
          ...group.toJSON(),
          roles:
            Array.isArray(group.roles) && group.roles.length > 0
              ? group.roles.map(r => r.name)
              : [DEFAULT_ROLE],
        },
      },
      201,
    );
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
    const { page = 1, limit = 10, search = '', role = '' } = req.query;

    // Get models from app context
    const models = req.app.get('models');

    // Get groups
    const result = await groupService.getGroups(
      { page, limit, search, role },
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

    return http.sendSuccess(res, {
      group: {
        ...group.toJSON(),
        roles:
          Array.isArray(group.roles) && group.roles.length > 0
            ? group.roles.map(r => r.name)
            : [DEFAULT_ROLE],
      },
    });
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
export async function updateGroupById(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { name, description, category, type, roles } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(updateGroupFormSchema, {
      name: name || '',
      description: description || '',
      category: category || '',
      type: type || '',
      roles: roles || [],
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Get models from app context
    const models = req.app.get('models');

    // Update group
    const group = await groupService.updateGroupById(
      id,
      { name, description, category, type, roles },
      models,
    );

    return http.sendSuccess(res, {
      group: {
        ...group.toJSON(),
        roles:
          Array.isArray(group.roles) && group.roles.length > 0
            ? group.roles.map(r => r.name)
            : [DEFAULT_ROLE],
      },
    });
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
 * Get group users
 *
 * @route   GET /api/admin/groups/:id/users
 * @access  Admin (requires 'groups:read' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getGroupUsers(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    // Get models from app context
    const models = req.app.get('models');

    const data = await groupService.getUsersWithGroup(
      id,
      { page, limit, offset, search },
      models,
    );

    return http.sendSuccess(res, data);
  } catch (error) {
    return http.sendServerError(res, 'Failed to get group users');
  }
}
