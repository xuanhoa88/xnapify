/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '@shared/validator';

import {
  updateUserFormSchema,
  createUserFormSchema,
  bulkUpdateUserStatusFormSchema,
  bulkDeleteUserFormSchema,
  createApiKeyFormSchema,
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
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const {
      email,
      password,
      confirm_password,
      profile,
      roles,
      groups,
      is_active,
    } = req.body;

    // Validate with Zod schema
    const [isValid, errors] = validateForm(createUserFormSchema, {
      email: email || '',
      password: password || '',
      confirm_password: confirm_password || '',
      profile: profile || {},
      roles: roles || [],
      groups: groups || [],
      is_active: is_active !== false,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Create user
    const user = await userAdminService.createUser(
      {
        email,
        password,
        profile,
        roles,
        groups,
        is_active,
      },
      {
        models: container.resolve('models'),
        actorId: req.user.id,
        defaultRoleName: container.resolve('auth').DEFAULT_ROLE,
        hook: container.resolve('hook'),
      },
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
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { page, limit } = http.getPagination(req);
    const { search = '', role = '', status = '', group = '' } = req.query;

    // Get models from app context
    const models = container.resolve('models');

    // Get user list
    const result = await userAdminService.getUserList(
      { page, limit, search, role, status, group },
      {
        models,
        hook: container.resolve('hook'),
        defaultRoleName: container.resolve('auth').DEFAULT_ROLE,
      },
    );

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
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { id } = req.params;

    // Get models from app context
    const models = container.resolve('models');

    // Get user by ID
    const user = await userAdminService.getUserById(id, {
      models,
      defaultRoleName: container.resolve('auth').DEFAULT_ROLE,
    });

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
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { id } = req.params;
    const { profile, password, roles, groups, is_active } = req.body;

    // Prevent admin from updating themselves
    if (req.user.id === id) {
      return http.sendError(res, 'Cannot update your own account', 400);
    }

    const [isValid, errors] = validateForm(updateUserFormSchema, {
      profile: profile || {},
      password: password || '',
      roles: roles || [],
      groups: groups || [],
      is_active: !!is_active,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Get models from app context
    const models = container.resolve('models');

    // Build update data - only include password if provided
    const updateData = {
      profile,
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
      actorId: req.user.id,
      defaultRoleName: container.resolve('auth').DEFAULT_ROLE,
      hook: container.resolve('hook'),
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
  const container = req.app.get('container');
  const http = container.resolve('http');
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

    // Get models from app context
    const models = container.resolve('models');

    // Bulk update status (activities logged in service)
    const result = await userAdminService.bulkUpdateStatus(
      filteredIds,
      state === 'active',
      {
        models,
        actorId: req.user.id,
        hook: container.resolve('hook'),
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
  const container = req.app.get('container');
  const http = container.resolve('http');
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
    const models = container.resolve('models');

    // Bulk delete users (activities logged in service)
    const result = await userAdminService.bulkDelete(ids, {
      models,
      actorId: req.user.id,
      hook: container.resolve('hook'),
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

/**
 * Delete a single user
 *
 * @route   DELETE /api/users/:id
 * @access  Admin
 */
export async function deleteUser(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { id } = req.params;
    const models = container.resolve('models');

    const result = await userAdminService.bulkDelete([id], {
      models,
      actorId: req.user.id,
      hook: container.resolve('hook'),
    });

    return http.sendSuccess(res, {
      message: 'User deleted successfully',
      deleted: result.deleted,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete user', error);
  }
}

/**
 * Export users to CSV/Excel
 *
 * @route   GET /api/admin/users/export
 * @access  Admin
 */
export async function exportUsers(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { search = '', role = '', status = '', group = '' } = req.query;
    const models = container.resolve('models');

    // For now, reuse getUserList without limit to get all matching users
    const result = await userAdminService.getUserList(
      { page: 1, limit: 1000, search, role, status, group },
      { models, hook: container.resolve('hook') },
    );

    return http.sendSuccess(res, {
      users: result.users,
      total: result.pagination.total,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to export users', error);
  }
}

// ========================================================================
// API KEY MANAGEMENT CONTROLLERS
// ========================================================================

/**
 * List API keys for a specific user
 *
 * @route   GET /api/admin/users/:id/api-keys
 * @access  Admin
 */
export async function listApiKeys(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const models = container.resolve('models');
  const { id } = req.params;

  try {
    const keys = await userAdminService.listApiKeys(id, models);

    return http.sendSuccess(res, { keys });
  } catch (error) {
    return http.sendServerError(res, 'Failed to list API keys', error);
  }
}

/**
 * Create a new API key for a user
 *
 * @route   POST /api/admin/users/:id/api-keys
 * @access  Admin
 */
export async function createApiKey(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const models = container.resolve('models');
  const jwt = container.resolve('jwt');
  const { id } = req.params;
  const { name, scopes = [], expiresIn } = req.body;

  try {
    // Validate with Zod schema
    const [isValid, errors] = validateForm(createApiKeyFormSchema, {
      name,
      expiresIn: expiresIn || null,
      scopes,
    });

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    // Create API key via service
    const cache = container.resolve('cache');
    const result = await userAdminService.createApiKey(
      id,
      { name, scopes, expiresIn, cache },
      { models, jwt, hook: container.resolve('hook') },
    );

    return http.sendSuccess(res, result);
  } catch (error) {
    return http.sendServerError(res, 'Failed to create API key', error);
  }
}

/**
 * Revoke (disable) an API key
 *
 * @route   DELETE /api/admin/users/:id/api-keys/:keyId
 * @access  Admin
 */
export async function revokeApiKey(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const models = container.resolve('models');
  const { id, keyId } = req.params;

  try {
    await userAdminService.revokeApiKey(id, keyId, {
      models,
      hook: container.resolve('hook'),
    });

    return http.sendSuccess(res, { message: 'API Key revoked' });
  } catch (error) {
    if (error.name === 'ApiKeyNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    return http.sendServerError(res, 'Failed to revoke API key', error);
  }
}

/**
 * Impersonate a user
 *
 * @route   POST /api/admin/users/:id/impersonate
 * @access  Admin
 */
export async function impersonate(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { id } = req.params;

    // Prevent self-impersonation
    if (req.user.id === id) {
      return http.sendError(res, 'Cannot impersonate yourself', 400);
    }

    const models = container.resolve('models');
    const authConfig = container.resolve('auth');
    const jwt = container.resolve('jwt');

    // Get user data via service
    const user = await userAdminService.impersonateUser(id, {
      models,
      defaultRoleName: authConfig.DEFAULT_ROLE,
      adminRoleName: authConfig.ADMIN_ROLE,
      defaultResources: authConfig.DEFAULT_RESOURCES,
      defaultActions: authConfig.DEFAULT_ACTIONS,
    });

    // Generate token pair with impersonator_id so refresh preserves the claim
    const tokens = jwt.generateTokenPair({
      id: user.id,
      email: user.email,
      picture: user.picture || null,
      impersonator_id: req.user.id,
    });

    // Set both cookies
    authConfig.setTokenCookie(res, tokens.accessToken);
    authConfig.setRefreshTokenCookie(res, tokens.refreshToken);

    // Log activity for auditing
    await req.app
      .get('hook')('auth.activity')
      .emit('impersonation:start', {
        admin_id: req.user.id,
        target_id: id,
        ip_address: http.getClientIP(req),
      });

    return http.sendSuccess(res, {
      message: `Now impersonating ${(user.profile && user.profile.display_name) || user.email}`,
      user,
      impersonatorId: req.user.id,
    });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    if (error.name === 'UserInactiveError') {
      return http.sendError(res, error.message, 403);
    }
    return http.sendServerError(res, 'Failed to start impersonation', error);
  }
}
