/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '@shared/validator';

import {
  createGroupFormSchema,
  updateGroupFormSchema,
} from '../../../validator/admin';
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

    // Get models and webhook from app context
    const models = req.app.get('models');

    // Create group
    const group = await groupService.createGroup(
      { name, description, category, type, roles },
      {
        models,
        webhook: req.app.get('webhook'),
        hook: req.app.get('hook'),
        actorId: req.user.id,
        defaultRoleName: req.app.get('auth').DEFAULT_ROLE,
      },
    );

    return http.sendSuccess(
      res,
      {
        group,
      },
      201,
    );
  } catch (error) {
    if (error.name === 'GroupAlreadyExistsError') {
      return http.sendValidationError(res, { name: error.message });
    }

    return http.sendServerError(res, 'Failed to create group', error);
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
    const { page, limit } = http.getPagination(req);
    const { search = '', role = '' } = req.query;

    // Get models from app context
    const models = req.app.get('models');

    // Get groups
    const result = await groupService.getGroups(
      {
        page,
        limit,
        search,
        role,
      },
      { models, defaultRoleName: req.app.get('auth').DEFAULT_ROLE },
    );

    return http.sendSuccess(res, result);
  } catch (error) {
    return http.sendServerError(res, 'Failed to get groups', error);
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

    const group = await groupService.getGroupById(id, {
      models: req.app.get('models'),
      defaultRoleName: req.app.get('auth').DEFAULT_ROLE,
    });
    if (!group) {
      return http.sendNotFound(res, 'Group not found');
    }

    return http.sendSuccess(res, {
      group,
    });
  } catch (error) {
    if (error.name === 'GroupNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    return http.sendServerError(res, 'Failed to get group', error);
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

    // Prevent user from modifying groups they belong to
    const userGroups = req.user.groups || [];
    if (userGroups.some(g => g === id)) {
      return http.sendError(res, 'Cannot update a group you belong to', 400);
    }

    // Update group
    const group = await groupService.updateGroupById(
      id,
      { name, description, category, type, roles },
      {
        models: req.app.get('models'),
        webhook: req.app.get('webhook'),
        hook: req.app.get('hook'),
        actorId: req.user.id,
        defaultRoleName: req.app.get('auth').DEFAULT_ROLE,
      },
    );

    return http.sendSuccess(res, {
      group,
    });
  } catch (error) {
    if (error.name === 'GroupAlreadyExistsError') {
      return http.sendValidationError(res, { name: error.message });
    }

    return http.sendServerError(res, 'Failed to update group', error);
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

    // Prevent user from deleting groups they belong to
    const userGroups = req.user.groups || [];
    if (userGroups.some(g => g === id)) {
      return http.sendError(res, 'Cannot delete a group you belong to', 400);
    }

    // Delete group (activity logged in service)
    await groupService.deleteGroup(id, {
      models: req.app.get('models'),
      webhook: req.app.get('webhook'),
      hook: req.app.get('hook'),
      actorId: req.user.id,
      systemGroups: req.app.get('auth').SYSTEM_GROUPS,
    });

    return http.sendSuccess(res, {
      message: `Group deleted successfully`,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete group', error);
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
    const { page, limit, offset } = http.getPagination(req);
    const { search = '' } = req.query;

    // Get models from app context
    const models = req.app.get('models');

    const data = await groupService.getUsersWithGroup(
      id,
      { page, limit, offset, search },
      models,
    );

    return http.sendSuccess(res, data);
  } catch (error) {
    return http.sendServerError(res, 'Failed to get group users', error);
  }
}
