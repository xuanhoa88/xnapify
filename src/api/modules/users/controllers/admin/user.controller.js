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
  updateUserLockStatusFormSchema,
  bulkDeleteUserFormSchema,
} from '../../../../../shared/validator/features/admin';
import * as userAdminService from '../../services/admin/user.service';
import { DEFAULT_ROLE } from '../../constants/rbac';

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

    // Get models from app context
    const models = req.app.get('models');

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
      models,
    );

    return http.sendSuccess(res, {
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        email_confirmed: user.email_confirmed,
        is_active: user.is_active,
        created_at: user.created_at,
        display_name: (user.profile && user.profile.display_name) || null,
        roles:
          Array.isArray(user.roles) && user.roles.length > 0
            ? user.roles.map(r => r.name)
            : [DEFAULT_ROLE],
        groups: user.groups || [],
      },
    });
  } catch (error) {
    if (error.name === 'UserAlreadyExistsError') {
      return http.sendValidationError(res, {
        email: 'Email is already in use by another user',
      });
    }
    return http.sendServerError(res, 'Failed to create user');
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
    const formattedUsers = result.users.map(user => ({
      id: user.id,
      email: user.email,
      email_confirmed: user.email_confirmed,
      is_active: user.is_active,
      is_locked: user.is_locked,
      failed_login_attempts: user.failed_login_attempts,
      created_at: user.created_at,
      updated_at: user.updated_at,
      display_name: (user.profile && user.profile.display_name) || null,
      first_name: (user.profile && user.profile.first_name) || null,
      last_name: (user.profile && user.profile.last_name) || null,
      picture: (user.profile && user.profile.picture) || null,
      roles:
        Array.isArray(user.roles) && user.roles.length > 0
          ? user.roles.map(r => r.name)
          : [DEFAULT_ROLE],
      groups: user.groups || [],
    }));

    return http.sendSuccess(res, {
      users: formattedUsers,
      pagination: result.pagination,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get user list');
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
      user: {
        id: user.id,
        email: user.email,
        email_confirmed: user.email_confirmed,
        is_active: user.is_active,
        is_locked: user.is_locked,
        failed_login_attempts: user.failed_login_attempts,
        created_at: user.created_at,
        updated_at: user.updated_at,
        display_name: (user.profile && user.profile.display_name) || null,
        first_name: (user.profile && user.profile.first_name) || null,
        last_name: (user.profile && user.profile.last_name) || null,
        picture: (user.profile && user.profile.picture) || null,
        bio: (user.profile && user.profile.bio) || null,
        location: (user.profile && user.profile.location) || null,
        website: (user.profile && user.profile.website) || null,
        roles:
          Array.isArray(user.roles) && user.roles.length > 0
            ? user.roles.map(r => r.name)
            : [DEFAULT_ROLE],
        groups: user.groups || [],
      },
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get user');
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

    // Get models from app context
    const models = req.app.get('models');

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
    const user = await userAdminService.updateUserById(id, updateData, models);

    return http.sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        email_confirmed: user.email_confirmed,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
        display_name: (user.profile && user.profile.display_name) || null,
        first_name: (user.profile && user.profile.first_name) || null,
        last_name: (user.profile && user.profile.last_name) || null,
        picture: (user.profile && user.profile.picture) || null,
        bio: (user.profile && user.profile.bio) || null,
        location: (user.profile && user.profile.location) || null,
        website: (user.profile && user.profile.website) || null,
        roles:
          Array.isArray(user.roles) && user.roles.length > 0
            ? user.roles.map(r => r.name)
            : [DEFAULT_ROLE],
        groups: user.groups || [],
      },
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

    return http.sendServerError(res, 'Failed to update user');
  }
}

/**
 * Lock/unlock user account
 *
 * @route   PUT /api/users/:id/lock
 * @access  Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updateUserLockStatus(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { is_locked, reason } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(updateUserLockStatusFormSchema, {
      is_locked,
      reason,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Prevent admin from locking themselves
    if (req.user.id === id && is_locked) {
      return http.sendError(res, 'Cannot lock your own account', 400);
    }

    // Get models from app context
    const models = req.app.get('models');

    // Update user lock status
    const user = await userAdminService.updateUserLockStatus(
      id,
      is_locked,
      reason,
      models,
    );

    return http.sendSuccess(res, {
      message: `User account ${is_locked ? 'locked' : 'unlocked'} successfully`,
      user: {
        id: user.id,
        email: user.email,
        is_locked: user.is_locked,
        failed_login_attempts: user.failed_login_attempts,
      },
    });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    return http.sendServerError(res, 'Failed to update user lock status');
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

    // Prevent admin from deactivating themselves
    if (ids.includes(req.user.id) && !(state === 'active')) {
      return http.sendError(res, 'Cannot deactivate your own account', 400);
    }

    // Get models from app context
    const models = req.app.get('models');

    // Bulk update status
    const result = await userAdminService.bulkUpdateStatus(
      ids,
      state === 'active',
      models,
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
    return http.sendServerError(res, 'Failed to bulk update user status');
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

    // Get models from app context
    const models = req.app.get('models');

    // Bulk delete users
    const result = await userAdminService.bulkDelete(ids, models);

    return http.sendSuccess(res, {
      message: `Deleted ${result.deleted} user(s)`,
      deleted: result.deleted,
      deletedIds: result.deletedIds,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to bulk delete users');
  }
}
