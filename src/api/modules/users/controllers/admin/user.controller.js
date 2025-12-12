/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as userAdminService from '../../services/admin/user.service';
import * as profileService from '../../services/profile.service';
import { SYSTEM_ROLES } from '../../constants/roles';

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
      role,
      is_active,
    } = req.body;

    // Validate required fields
    if (!email || !password) {
      return http.sendValidationError(res, {
        email: !email ? 'Email is required' : undefined,
        password: !password ? 'Password is required' : undefined,
      });
    }

    // Validate password match
    if (confirm_password && password !== confirm_password) {
      return http.sendValidationError(res, {
        confirm_password: 'Passwords do not match',
      });
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
        role,
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
        role: user.roles && user.roles.length > 0 ? user.roles[0].name : 'user',
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
    const {
      page = 1,
      limit = 10,
      search = '',
      role = '',
      status = '',
      group = '',
    } = req.query;

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
      roles: user.roles ? user.roles.map(r => r.name) : [],
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
    const user = await profileService.getUserWithProfile(id, models);

    if (!user) {
      return http.sendNotFound(res, 'User not found');
    }

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
        role: user.role || 'user',
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
      email,
      display_name,
      first_name,
      last_name,
      bio,
      location,
      website,
      role,
      is_active,
    } = req.body;

    // Prevent admin from updating themselves
    if (req.user.id === id) {
      return http.sendError(res, 'Cannot update your own account', 400);
    }

    // Get models from app context
    const models = req.app.get('models');

    // Update user
    const user = await userAdminService.updateUserById(
      id,
      {
        email,
        display_name,
        first_name,
        last_name,
        bio,
        location,
        website,
        role,
        is_active,
      },
      models,
    );

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
        role: user.role || 'user',
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
 * Delete user by ID
 *
 * @route   DELETE /api/users/:id
 * @access  Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function deleteUserById(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user.id === id) {
      return http.sendValidationError(res, {
        id: 'Cannot delete your own account',
      });
    }

    // Get models from app context
    const models = req.app.get('models');
    const { User } = models;

    // Get user
    const user = await User.findByPk(id);
    if (!user) {
      return http.sendNotFound(res, 'User not found');
    }

    // Delete user (cascade will handle profile)
    await user.destroy();

    return http.sendSuccess(res, {
      message: `User ${user.email} deleted successfully`,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete user');
  }
}

/**
 * Update user role
 *
 * @route   PUT /api/users/:id/role
 * @access  Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updateUserRole(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    if (!role) {
      return http.sendValidationError(res, {
        role: `Role must be one of: ${SYSTEM_ROLES.join(', ')}`,
      });
    }

    // Prevent admin from changing their own role
    if (req.user.id === id) {
      return http.sendError(res, 'Cannot change your own role', 400);
    }

    // Get models from app context
    const models = req.app.get('models');

    // Update user role
    const user = await userAdminService.updateUserRole(id, role, models);

    return http.sendSuccess(res, {
      message: `User role updated to ${role}`,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    return http.sendServerError(res, 'Failed to update user role');
  }
}

/**
 * Update user status (active/inactive)
 *
 * @route   PUT /api/users/:id/status
 * @access  Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updateUserStatus(req, res) {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    // Validate status
    if (typeof is_active !== 'boolean') {
      return http.sendValidationError(res, {
        is_active: 'Status must be true or false',
      });
    }

    // Prevent admin from deactivating themselves
    if (req.user.id === id && !is_active) {
      return http.sendError(res, 'Cannot deactivate your own account', 400);
    }

    // Get models from app context
    const models = req.app.get('models');

    // Update user status
    const user = await userAdminService.updateUserStatus(id, is_active, models);

    return http.sendSuccess(res, {
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user.id,
        email: user.email,
        is_active: user.is_active,
      },
    });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendNotFound(res, error.message);
    }

    return http.sendServerError(res, 'Failed to update user status');
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

    // Validate input
    if (typeof is_locked !== 'boolean') {
      return http.sendValidationError(res, {
        is_locked: 'Lock status must be true or false',
      });
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
 * Get user statistics
 *
 * @route   GET /api/users/stats
 * @access  Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getUserStats(req, res) {
  const http = req.app.get('http');
  try {
    // Get models from app context
    const models = req.app.get('models');

    // Get user statistics
    const stats = await userAdminService.getUserStats(models);

    return http.sendSuccess(res, { stats });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get user statistics');
  }
}

/**
 * Bulk update users
 *
 * @route   PUT /api/users/bulk
 * @access  Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function bulkUpdateUsers(req, res) {
  const http = req.app.get('http');
  try {
    const { user_ids, updates } = req.body;

    // Validate input
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return http.sendValidationError(res, {
        user_ids: 'User IDs must be a non-empty array',
      });
    }

    if (!updates || typeof updates !== 'object') {
      return http.sendValidationError(res, {
        updates: 'Updates must be an object',
      });
    }

    // Prevent admin from updating themselves
    if (user_ids.includes(req.user.id)) {
      return http.sendError(res, 'Cannot bulk update your own account', 400);
    }

    // Get models from app context
    const models = req.app.get('models');

    // Perform bulk update
    const result = await userAdminService.bulkUpdateUsers(
      user_ids,
      updates,
      models,
    );

    return http.sendSuccess(res, {
      message: `${result.updatedCount} users updated successfully`,
      ...result,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to bulk update users');
  }
}
