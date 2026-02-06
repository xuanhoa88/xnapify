/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '../../../../../shared/validator';
import {
  updateUserFormSchema,
  createUserFormSchema,
  bulkUpdateUserStatusFormSchema,
  bulkDeleteUserFormSchema,
} from '../../../validator/admin';
import * as userAdminService from '../../services/admin/user.service';

// ========================================================================
// USER ADMINISTRATION CONTROLLERS (Admin Only)
// ========================================================================

/**
 * Create a new user
 *
 * @route   POST /api/admin/users
 * @access  Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function createUser(req, res) {
  const http = req.app.get('http');
  try {
    const {
      email,
      password,
      confirm_password,
      display_name,
      first_name,
      last_name,
      roles,
      groups,
      is_active,
    } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(createUserFormSchema, {
      email: email || '',
      password: password || '',
      confirm_password: confirm_password || '',
      display_name: display_name || '',
      first_name: first_name || '',
      last_name: last_name || '',
      roles: roles || [],
      groups: groups || [],
      is_active: is_active !== false,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Get models and webhook from app context
    const models = req.app.get('models');
    const webhook = req.app.get('webhook');

    // Create user
    const user = await userAdminService.createUser(
      {
        email,
        password,
        display_name,
        first_name,
        last_name,
        roles,
        groups,
        is_active,
      },
      { models, webhook, actorId: req.user.id },
    );

    return http.sendSuccess(res, {
      message: 'User created successfully',
      user,
    });
  } catch (error) {
    if (error.name === 'UserAlreadyExistsError') {
      return http.sendValidationError(res, {
        email: 'Email is already in use by another user',
      });
    }
    return http.sendServerError(res, 'Failed to create user', error);
  }
}

/**
 * Get paginated list of all users
 *
 * @route   GET /api/admin/users/list
 * @access  Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getUserList(req, res) {
  const http = req.app.get('http');
  try {
    const { page, limit } = http.getPagination(req);
    const { search = '', role = '', status = '', group = '' } = req.query;

    // Get models from app context
    const models = req.app.get('models');

    // Get user list
    const result = await userAdminService.getUserList(
      { page, limit, search, role, status, group },
      models,
    );

    // Format users to include roles and groups arrays

    return http.sendSuccess(res, {
      users: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get user list', error);
  }
}

/**
 * Get specific user by ID
 *
 * @route   GET /api/users/:id
 * @access  Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getUserById(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;

    // Get models from app context
    const models = req.app.get('models');

    // Get user by ID
    const user = await userAdminService.getUserById(id, models);

    return http.sendSuccess(res, {
      user,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get user', error);
  }
}

/**
 * Update user by ID
 *
 * @route   PUT /api/users/:id
 * @access  Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updateUserById(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const {
      display_name,
      first_name,
      last_name,
      password,
      roles,
      groups,
      is_active,
    } = req.body;

    // Prevent admin from updating themselves
    if (req.user.id === id) {
      return http.sendError(res, 'Cannot update your own account', 400);
    }

    const [isValid, errors] = validateForm(updateUserFormSchema, {
      display_name,
      first_name,
      last_name,
      password: password || '',
      roles: roles || [],
      groups: groups || [],
      is_active: !!is_active,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Get models and webhook from app context
    const models = req.app.get('models');
    const webhook = req.app.get('webhook');

    // Build update data - only include password if provided
    const updateData = {
      display_name,
      first_name,
      last_name,
      roles,
      groups,
      is_active,
    };

    // Only include password if it's provided and not empty
    if (password && password.length > 0) {
      updateData.password = password;
    }

    // Update user
    const user = await userAdminService.updateUserById(id, updateData, {
      models,
      webhook,
      actorId: req.user.id,
    });

    return http.sendSuccess(res, {
      message: 'User updated successfully',
      user,
    });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    if (error.name === 'UserAlreadyExistsError') {
      return http.sendValidationError(res, {
        email: 'Email is already in use by another user',
      });
    }

    return http.sendServerError(res, 'Failed to update user', error);
  }
}

/**
 * Bulk update user status
 *
 * @route   PATCH /api/admin/users/status
 * @access  Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function bulkUpdateStatus(req, res) {
  const http = req.app.get('http');
  try {
    const { ids, state } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(bulkUpdateUserStatusFormSchema, {
      ids,
      state,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Filter out current user's ID to prevent self-status change
    const filteredIds = ids.filter(id => id !== req.user.id);

    if (filteredIds.length === 0) {
      return http.sendError(res, 'Cannot change your own account status', 400);
    }

    // Get models and webhook from app context
    const models = req.app.get('models');
    const webhook = req.app.get('webhook');

    // Bulk update status (activity logged in service)
    const result = await userAdminService.bulkUpdateStatus(
      filteredIds,
      state === 'active',
      {
        models,
        webhook,
        actorId: req.user.id,
      },
    );

    return http.sendSuccess(res, {
      message: `${result.updated} user(s) ${state === 'active' ? 'activated' : 'deactivated'} successfully`,
      users: result.users.map(u => ({
        id: u.id,
        email: u.email,
        is_active: u.is_active,
      })),
      updated: result.updated,
    });
  } catch (error) {
    return http.sendServerError(
      res,
      'Failed to bulk update user status',
      error,
    );
  }
}

/**
 * Bulk delete users
 *
 * @route   DELETE /api/admin/users
 * @access  Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function bulkDelete(req, res) {
  const http = req.app.get('http');
  try {
    const { ids } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(bulkDeleteUserFormSchema, {
      ids,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Prevent admin from deleting themselves
    if (ids.includes(req.user.id)) {
      return http.sendError(res, 'Cannot delete your own account', 400);
    }

    // Get models and webhook from app context
    const models = req.app.get('models');
    const webhook = req.app.get('webhook');

    // Bulk delete users (activity logged in service)
    const result = await userAdminService.bulkDelete(ids, {
      models,
      webhook,
      actorId: req.user.id,
    });

    return http.sendSuccess(res, {
      message: `Deleted ${result.deleted} user(s)`,
      deleted: result.deleted,
      deletedIds: result.deletedIds,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to bulk delete users', error);
  }
}
