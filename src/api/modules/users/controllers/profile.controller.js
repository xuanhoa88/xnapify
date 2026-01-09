/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '../../../../shared/validator';
import i18n from '../../../../shared/i18n';
import {
  changePasswordFormSchema,
  deleteAccountFormSchema,
  updateProfileFormSchema,
  updatePreferencesFormSchema,
} from '../../../../shared/validator/features/auth';
import { DEFAULT_ROLE } from '../constants/rbac';
import * as profileService from '../services/profile.service';

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

/**
 * Format user profile response
 * @param {Object} user - User object with profile, roles, and groups
 * @returns {Object} Formatted profile object
 */
function formatProfileResponse(user) {
  return {
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
  };
}

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
    const models = req.app.get('models');
    const user = await profileService.getUserWithProfile(req.user.id, models);

    if (!user) {
      return http.sendNotFound(res, 'User not found');
    }

    return http.sendSuccess(res, {
      profile: formatProfileResponse(user),
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

    // Validate input using shared schema
    const [isValid, validationErrors] = validateForm(updateProfileFormSchema, {
      display_name,
      first_name,
      last_name,
      bio,
      location,
      website,
    });
    if (!isValid) {
      return http.sendValidationError(res, validationErrors[0]);
    }

    const models = req.app.get('models');
    const user = await profileService.updateUserProfile(
      req.user.id,
      { display_name, first_name, last_name, bio, location, website },
      models,
    );

    return http.sendSuccess(res, {
      profile: formatProfileResponse(user),
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to update profile');
  }
}

/**
 * Upload user avatar image
 *
 * Uses fs engine's uploadMiddleware internally - no direct multer import.
 *
 * @route   POST /api/profile/avatar
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function uploadAvatar(req, res) {
  const http = req.app.get('http');
  const fs = req.app.get('fs');
  const models = req.app.get('models');

  try {
    // Use fs engine's uploadFiles with asMiddleware option (handles multer internally)
    const fsControllers = fs.createControllers();
    const upload = fsControllers.uploadFiles({
      maxFiles: 1,
      maxFileSize: 10 * 1024 * 1024, // 10MB for user avatars
      fileFieldName: 'avatar',
      asMiddleware: true, // Store result in req[UPLOAD] and call next()
    });

    // Run upload as middleware
    await new Promise((resolve, reject) => {
      upload(req, res, err => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Check upload result using Symbol
    const uploadResult = req[fs.MIDDLEWARE_RESULT.UPLOAD];
    if (!uploadResult || !uploadResult.success) {
      const errorMsg =
        (uploadResult && uploadResult.error) || 'No file uploaded';
      return http.sendValidationError(res, { avatar: errorMsg });
    }

    // Get the uploaded file name from the result
    const uploadedFiles = uploadResult.data && uploadResult.data.successful;
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return http.sendValidationError(res, {
        avatar: i18n.t('zod:profile.AVATAR_REQUIRED'),
      });
    }

    // Link the uploaded file as avatar
    const { fileName } = uploadedFiles[0].data;
    const user = await profileService.linkUserAvatar(req.user.id, fileName, {
      models,
      fs,
    });

    return http.sendSuccess(res, {
      message: 'Avatar uploaded successfully',
      profile: {
        id: user.id,
        email: user.email,
        picture: (user.profile && user.profile.picture) || null,
      },
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to upload avatar');
  }
}

/**
 * Remove user avatar
 *
 * Uses fs engine's deleteFiles with asMiddleware option.
 *
 * @route   DELETE /api/profile/avatar
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function removeAvatar(req, res) {
  const http = req.app.get('http');
  const fs = req.app.get('fs');
  const models = req.app.get('models');
  const { User, UserProfile } = models;

  try {
    // Get user with profile to find current avatar
    const user = await User.findByPk(req.user.id, {
      include: [{ model: UserProfile, as: 'profile' }],
    });

    if (!user) {
      return http.sendNotFound(res, 'User not found');
    }

    if (!user.profile || !user.profile.picture) {
      return http.sendValidationError(res, {
        avatar: 'No avatar to remove',
      });
    }

    const avatarFileName = user.profile.picture;

    // Use fs engine's deleteFiles with asMiddleware option
    const fsControllers = fs.createControllers();

    // Inject fileName into request body for deleteFiles controller
    req.body = { fileName: avatarFileName };

    const deleteMiddleware = fsControllers.deleteFiles({
      asMiddleware: true, // Store result in req[DELETE] and call next()
    });

    // Run delete as middleware
    await new Promise((resolve, reject) => {
      deleteMiddleware(req, res, err => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Check delete result using Symbol
    const deleteResult = req[fs.MIDDLEWARE_RESULT.DELETE];
    if (!deleteResult || !deleteResult.success) {
      // Log warning but continue - file may already be deleted
      console.warn(
        'Failed to delete avatar file:',
        deleteResult && deleteResult.error,
      );
    }

    // Update profile to remove avatar reference
    await user.profile.update({ picture: null });

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
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    // Validate input using shared schema
    const [isValid, validationErrors] = validateForm(changePasswordFormSchema, {
      currentPassword,
      newPassword,
      confirmNewPassword,
    });
    if (!isValid) {
      return http.sendValidationError(res, validationErrors[0]);
    }

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
    const models = req.app.get('models');

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

    // Validate input using shared schema
    const [isValid, validationErrors] = validateForm(
      updatePreferencesFormSchema,
      {
        language,
        timezone,
        notifications,
        theme,
      },
    );
    if (!isValid) {
      return http.sendValidationError(res, validationErrors[0]);
    }

    const models = req.app.get('models');
    const preferences = await profileService.updateUserPreferences(
      req.user.id,
      { language, timezone, notifications, theme },
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
    const models = req.app.get('models');
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
    const { password, confirmPassword } = req.body;

    // Validate input using shared schema
    const [isValid, validationErrors] = validateForm(deleteAccountFormSchema, {
      password,
      confirmPassword,
    });
    if (!isValid) {
      return http.sendValidationError(res, validationErrors[0]);
    }

    await profileService.deleteUserAccount(req.user.id, password, {
      models: req.app.get('models'),
      auth: req.app.get('auth'),
    });

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
