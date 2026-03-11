/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm, z } from '@shared/validator';
import {
  updateProfileFormSchema,
  changePasswordFormSchema,
  deleteAccountFormSchema,
  updatePreferencesFormSchema,
} from '../../validator/auth';
import * as profileService from '../services/profile.service';
import { formatUserResponse } from '../utils/formatter';

// ========================================================================
// PROFILE MANAGEMENT CONTROLLERS
// ========================================================================

/**
 * Get user profile with extended information
 *
 * @route   GET /api/auth/profile
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getProfile(req, res) {
  const http = req.app.get('http');
  const hook = req.app.get('hook').withContext(req.app);
  try {
    const user = await profileService.getUserWithProfile(req.user.id, {
      models: req.app.get('models'),
    });

    if (!user) {
      return http.sendNotFound(res, 'User not found');
    }

    // Format user response
    const auth = req.app.get('auth');
    const normalizedUser = await formatUserResponse(user, {
      adminRoleName: auth.ADMIN_ROLE,
      defaultRoleName: auth.DEFAULT_ROLE,
      defaultResources: auth.DEFAULT_RESOURCES,
      defaultActions: auth.DEFAULT_ACTIONS,
    });

    // Emit hook event for plugins to modify the response
    await hook('profile').emit('retrieved', normalizedUser);

    return http.sendSuccess(res, { user: normalizedUser });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get user profile', error);
  }
}

/**
 * Update user profile information
 *
 * @route   PUT /api/auth/profile
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updateProfile(req, res) {
  const http = req.app.get('http');
  const hook = req.app.get('hook').withContext(req.app);
  const i18n = req.app.get('i18n');

  try {
    // 1. Initialize base schema
    const baseSchema = updateProfileFormSchema({ i18n, z });

    // 2. Allow plugins to extend the schema via hooks
    // We pass a mutable context with the schema
    const context = {
      schema: baseSchema,
      i18n,
      z,
    };

    await hook('profile').emit('validation:update', context);

    // 3. Validate using the (potentially extended) schema
    // We wrap it in a factory because validateForm expects a function
    const [isValid, dataOrErrors] = validateForm(
      () => context.schema,
      req.body,
    );

    if (!isValid) {
      return http.sendValidationError(res, dataOrErrors);
    }

    // 4. Update user profile with validated data
    const user = await profileService.updateUserProfile(
      req.user.id,
      dataOrErrors,
      {
        models: req.app.get('models'),
        webhook: req.app.get('webhook'),
        searchWorker: req.app.get('container').resolve('search:worker'),
        hook,
      },
    );

    // Format user response
    const auth = req.app.get('auth');
    const normalizedUser = await formatUserResponse(user, {
      adminRoleName: auth.ADMIN_ROLE,
      defaultRoleName: auth.DEFAULT_ROLE,
      defaultResources: auth.DEFAULT_RESOURCES,
      defaultActions: auth.DEFAULT_ACTIONS,
    });

    return http.sendSuccess(res, { profile: normalizedUser });
  } catch (error) {
    return http.sendServerError(res, 'Failed to update profile', error);
  }
}

/**
 * Upload user avatar image
 *
 * Middleware runs in routes via fs.useUploadMiddleware()
 *
 * @route   POST /api/auth/profile/avatar
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function uploadAvatar(req, res) {
  const http = req.app.get('http');
  const fs = req.app.get('fs');
  const models = req.app.get('models');
  const { UserProfile } = models;

  try {
    // Check upload result from middleware (runs in routes)
    const uploadResult = req[fs.MIDDLEWARES.UPLOAD];
    if (!uploadResult || !uploadResult.success) {
      const errorMsg =
        (uploadResult && uploadResult.error) || 'No file uploaded';
      return http.sendValidationError(res, { avatar: errorMsg });
    }

    const { fileName } = uploadResult.data;
    if (!fileName) {
      return http.sendValidationError(res, {
        avatar: 'Avatar is required',
      });
    }

    // Get user with profile
    const user = await profileService.getUserWithProfile(req.user.id, {
      models,
    });

    // Store old avatar for cleanup
    const oldAvatarPath = user.profile && user.profile.picture;

    // Update profile with new avatar via EAV upsert
    await UserProfile.upsert({
      user_id: req.user.id,
      attribute_key: 'picture',
      attribute_value: fileName,
    });

    // Delete old avatar if different
    if (oldAvatarPath && oldAvatarPath !== fileName) {
      try {
        await fs.remove(oldAvatarPath);
      } catch (error) {
        console.warn('Failed to delete old avatar:', error.message);
      }
    }

    return http.sendSuccess(res, {
      message: 'Avatar uploaded successfully',
      profile: {
        id: user.id,
        email: user.email,
        picture: fileName,
      },
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to upload avatar', error);
  }
}

/**
 * Preview user avatar
 *
 * Uses picture from auth token if available to avoid DB query.
 * If avatar is an external URL, redirects to it.
 * Returns default avatar on any error (for img tag compatibility).
 *
 * @route   GET /api/auth/profile/avatar
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function previewAvatar(req, res) {
  const fs = req.app.get('fs');

  // Default avatar URL (can be configured via env)
  const defaultAvatar =
    process.env.RSK_AVATAR_DEFAULT_URL ||
    'https://ui-avatars.com/api/?background=random&name=User';

  // Safe redirect helper - never throws
  const safeRedirect = url => {
    try {
      if (!res.headersSent) {
        res.redirect(url);
      }
    } catch (e) {
      // Last resort - send empty response
      if (!res.headersSent) {
        res.status(204).end();
      }
    }
  };

  try {
    // Get avatar path from query param (for updated avatar) or from auth token
    const avatarPath =
      req.query.fileName || (req.user.profile && req.user.profile.picture);

    // No avatar - redirect to default
    if (typeof avatarPath !== 'string' || avatarPath.trim().length === 0) {
      return safeRedirect(defaultAvatar);
    }

    // Check if avatar is an external URL (e.g., from OAuth/social login)
    if (/^https?:\/\//i.test(avatarPath)) {
      return safeRedirect(avatarPath);
    }

    // Local file - stream from fs
    const result = await fs.preview(avatarPath);

    if (!result.success) {
      // File not found - redirect to default
      return safeRedirect(defaultAvatar);
    }

    // Set headers and pipe stream
    Object.entries(result.data.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    result.data.stream.pipe(res);
  } catch (error) {
    // Any error - redirect to default avatar
    return safeRedirect(defaultAvatar);
  }
}

/**
 * Remove user avatar
 *
 * @route   DELETE /api/auth/profile/avatar
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function removeAvatar(req, res) {
  const http = req.app.get('http');
  const fs = req.app.get('fs');
  const models = req.app.get('models');
  const { UserProfile } = models;

  try {
    // Get user with profile to find current avatar
    const user = await profileService.getUserWithProfile(req.user.id, {
      models: req.app.get('models'),
    });

    if (!user) {
      return http.sendNotFound(res, 'User not found');
    }

    const pictureAttrValue = user.profile && user.profile.picture;

    if (!pictureAttrValue) {
      return http.sendValidationError(res, {
        avatar: 'No avatar to remove',
      });
    }

    // Delete the avatar file using fs.remove()
    try {
      await fs.remove(pictureAttrValue);
    } catch (error) {
      // Log warning but continue - file may already be deleted
      console.warn('Failed to delete avatar file:', error.message);
    }

    // Remove avatar EAV row
    await UserProfile.destroy({
      where: { user_id: req.user.id, attribute_key: 'picture' },
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
    return http.sendServerError(res, 'Failed to remove avatar', error);
  }
}

/**
 * Change user password
 *
 * @route   PUT /api/auth/profile/password
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
      return http.sendValidationError(res, validationErrors);
    }

    await profileService.changeUserPassword(
      req.user.id,
      currentPassword,
      newPassword,
      {
        models: req.app.get('models'),
        webhook: req.app.get('webhook'),
        hook: req.app.get('hook').withContext(req.app),
      },
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

    return http.sendServerError(res, 'Failed to change password', error);
  }
}

/**
 * Update user preferences
 *
 * @route   PUT /api/auth/profile/preferences
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
      return http.sendValidationError(res, validationErrors);
    }

    const preferences = await profileService.updateUserPreferences(
      req.user.id,
      { language, timezone, notifications, theme },
      {
        models: req.app.get('models'),
        webhook: req.app.get('webhook'),
        hook: req.app.get('hook').withContext(req.app),
      },
    );

    return http.sendSuccess(res, {
      message: 'Preferences updated successfully',
      preferences,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to update preferences', error);
  }
}

/**
 * Get user preferences
 *
 * @route   GET /api/auth/profile/preferences
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getPreferences(req, res) {
  const http = req.app.get('http');
  try {
    const preferences = await profileService.getUserPreferences(req.user.id, {
      models: req.app.get('models'),
      hook: req.app.get('hook').withContext(req.app),
    });

    return http.sendSuccess(res, { preferences });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get preferences', error);
  }
}

/**
 * Delete user account
 *
 * @route   DELETE /api/auth/profile
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
      return http.sendValidationError(res, validationErrors);
    }

    await profileService.deleteUserAccount(req.user.id, password, {
      models: req.app.get('models'),
      webhook: req.app.get('webhook'),
      searchWorker: req.app.get('container').resolve('search:worker'),
      hook: req.app.get('hook').withContext(req.app),
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

    return http.sendServerError(res, 'Failed to delete user', error);
  }
}
