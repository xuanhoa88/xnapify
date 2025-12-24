/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { DEFAULT_ROLE } from '../constants/rbac';
import * as profileService from '../services/profile.service';
import { validatePassword } from '../utils/validation';

// ========================================================================
// PROFILE MANAGEMENT CONTROLLERS
// ========================================================================

/**
 * Get user profile with extended information
 *
 * @route   GET /api/profile
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getProfile(req, res) {
  const http = req.app.get('http');
  try {
    // Get models from app context
    const models = req.app.get('models');

    // Get user with profile
    const user = await profileService.getUserWithProfile(req.user.id, models);

    if (!user) {
      return http.sendNotFound(res, 'User not found');
    }

    return http.sendSuccess(res, {
      profile: {
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
            ? user.roles.map(role => role.name)
            : [DEFAULT_ROLE],
        groups: user.groups || [],
      },
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get user profile');
  }
}

/**
 * Update user profile information
 *
 * @route   PUT /api/profile
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updateProfile(req, res) {
  const http = req.app.get('http');
  try {
    const { display_name, first_name, last_name, bio, location, website } =
      req.body;

    // Get models from app context
    const models = req.app.get('models');

    // Update user profile
    const user = await profileService.updateUserProfile(
      req.user.id,
      {
        display_name,
        first_name,
        last_name,
        bio,
        location,
        website,
      },
      models,
    );

    return http.sendSuccess(res, {
      profile: {
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
            ? user.roles.map(role => role.name)
            : [DEFAULT_ROLE],
        groups: user.groups || [],
      },
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to update profile');
  }
}

/**
 * Upload user avatar image
 *
 * @route   POST /api/profile/avatar
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function uploadAvatar(req, res) {
  const http = req.app.get('http');
  try {
    if (!req.file) {
      return http.sendValidationError(res, {
        avatar: 'Avatar image is required',
      });
    }

    // Get filesystem actions and models from app context
    const fs = req.app.get('fs');
    const models = req.app.get('models');

    // Upload avatar
    const user = await profileService.uploadUserAvatar(req.user.id, req.file, {
      models,
      fs,
    });

    // Respond with success message and updated profile
    return http.sendSuccess(res, {
      message: 'Avatar uploaded successfully',
      profile: {
        id: user.id,
        email: user.email,
        picture: (user.profile && user.profile.picture) || null,
      },
    });
  } catch (error) {
    if (error.name === 'INVALID_FILE_TYPE') {
      return http.sendValidationError(res, {
        avatar: 'Invalid file type. Only JPEG, PNG, and GIF are allowed',
      });
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return http.sendValidationError(res, {
        avatar: 'File too large. Maximum size is 5MB',
      });
    }

    if (error.name === 'LIMIT_FILE_COUNT') {
      return http.sendValidationError(res, {
        avatar: 'File count exceeds limit',
      });
    }

    return http.sendServerError(res, 'Failed to upload avatar');
  }
}

/**
 * Link uploaded file as user avatar
 *
 * @route   PUT /api/profile/avatar
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function linkAvatar(req, res) {
  const http = req.app.get('http');
  try {
    const { fileName } = req.body;

    if (!fileName) {
      return http.sendValidationError(res, {
        fileName: 'fileName is required',
      });
    }

    // Get filesystem actions and models from app context
    const fs = req.app.get('fs');
    const models = req.app.get('models');

    // Validate file exists
    const fileExists = await fs.actions.fileExists(fileName);
    if (!fileExists) {
      return http.sendValidationError(res, {
        fileName: 'File not found. Please upload the file first.',
      });
    }

    // Update user profile with avatar
    const user = await profileService.linkUserAvatar(req.user.id, fileName, {
      models,
      fs,
    });

    // Respond with success message and updated profile
    return http.sendSuccess(res, {
      message: 'Avatar linked successfully',
      profile: {
        id: user.id,
        email: user.email,
        picture: (user.profile && user.profile.picture) || null,
      },
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to link avatar');
  }
}

/**
 * Remove user avatar
 *
 * @route   DELETE /api/profile/avatar
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function removeAvatar(req, res) {
  const http = req.app.get('http');
  try {
    // Get filesystem actions and models from app context
    const fs = req.app.get('fs');
    const models = req.app.get('models');

    // Remove avatar
    const user = await profileService.removeUserAvatar(req.user.id, {
      models,
      fs,
    });

    return http.sendSuccess(res, {
      message: 'Avatar removed successfully',
      profile: {
        id: user.id,
        email: user.email,
        picture: null,
      },
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to remove avatar');
  }
}

/**
 * Change user password
 *
 * @route   PUT /api/profile/password
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function changePassword(req, res) {
  const http = req.app.get('http');
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    const errors = {};
    if (!currentPassword) {
      errors.currentPassword = 'PASSWORD_REQUIRED';
    }
    if (!newPassword) {
      errors.newPassword = 'PASSWORD_REQUIRED';
    } else {
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        errors.newPassword = passwordValidation.errors[0];
      }
    }

    if (Object.keys(errors).length > 0) {
      return http.sendValidationError(res, errors);
    }

    // Change password
    await profileService.changeUserPassword(
      req.user.id,
      currentPassword,
      newPassword,
      { models: req.app.get('models'), auth: req.app.get('auth') },
    );

    return http.sendSuccess(res, {
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error.name === 'InvalidPasswordError') {
      return http.sendValidationError(res, {
        currentPassword: 'Current password is incorrect',
      });
    }

    return http.sendServerError(res, 'Failed to change password');
  }
}

/**
 * Get user activities
 *
 * @route   GET /api/profile/activities
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getUserActivities(req, res) {
  const http = req.app.get('http');
  try {
    const { page = 1, limit = 10 } = req.query;

    // Get models from app context
    const models = req.app.get('models');

    // Get user activity
    const result = await profileService.getUserActivities(
      req.user.id,
      { page, limit },
      models,
    );

    return http.sendSuccess(res, result);
  } catch (error) {
    return http.sendServerError(res, 'Failed to get user activity');
  }
}

/**
 * Update user preferences
 *
 * @route   PUT /api/profile/preferences
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updatePreferences(req, res) {
  const http = req.app.get('http');
  try {
    const { language, timezone, notifications, theme } = req.body;

    // Get models from app context
    const models = req.app.get('models');

    // Update preferences
    const preferences = await profileService.updateUserPreferences(
      req.user.id,
      {
        language,
        timezone,
        notifications,
        theme,
      },
      models,
    );

    return http.sendSuccess(res, {
      message: 'Preferences updated successfully',
      preferences,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to update preferences');
  }
}

/**
 * Get user preferences
 *
 * @route   GET /api/profile/preferences
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getPreferences(req, res) {
  const http = req.app.get('http');
  try {
    // Get models from app context
    const models = req.app.get('models');

    // Get preferences
    const preferences = await profileService.getUserPreferences(
      req.user.id,
      models,
    );

    return http.sendSuccess(res, { preferences });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get preferences');
  }
}

/**
 * Delete user account
 *
 * @route   DELETE /api/profile
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function deleteAccount(req, res) {
  const http = req.app.get('http');
  try {
    const { password, confirm } = req.body;

    // Validate input
    const errors = {};
    if (!password) {
      errors.password = 'PASSWORD_REQUIRED';
    }
    if (confirm !== 'DELETE_MY_ACCOUNT') {
      errors.confirm = 'CONFIRMATION_REQUIRED';
    }

    if (Object.keys(errors).length > 0) {
      return http.sendValidationError(res, errors);
    }

    // Delete account
    await profileService.deleteUserAccount(req.user.id, password, {
      models: req.app.get('models'),
      auth: req.app.get('auth'),
    });

    // Clear token cookie
    req.app.get('auth').clearAllAuthCookies(res);

    return http.sendSuccess(res, {
      message: 'User deleted successfully',
    });
  } catch (error) {
    if (error.name === 'InvalidPasswordError') {
      return http.sendValidationError(res, {
        password: 'Password is incorrect',
      });
    }

    return http.sendServerError(res, 'Failed to delete user');
  }
}
