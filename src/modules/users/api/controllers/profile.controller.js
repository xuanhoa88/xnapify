/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '../../../../shared/validator';
import {
  changePasswordFormSchema,
  deleteAccountFormSchema,
  updateProfileFormSchema,
  updatePreferencesFormSchema,
} from '../../validator/auth';
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
    const user = await profileService.getUserWithProfile(req.user.id, {
      models: req.app.get('models'),
      hook: req.app.get('hook').withContext(req.app)
    });

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

    const user = await profileService.updateUserProfile(
      req.user.id,
      { display_name, first_name, last_name, bio, location, website },
      {
        models: req.app.get('models'),
        webhook: req.app.get('webhook'),
        hook: req.app.get('hook').withContext(req.app)
      },
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
 * Middleware runs in routes via fs.useUploadMiddleware()
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
      hook: req.app.get('hook').withContext(req.app)
    });

    // Store old avatar for cleanup
    const oldAvatarPath = user.profile && user.profile.picture;

    // Update profile with new avatar
    if (user.profile) {
      await user.profile.update({ picture: fileName });
    } else {
      await UserProfile.create({ user_id: req.user.id, picture: fileName });
    }

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
    return http.sendServerError(res, 'Failed to upload avatar');
  }
}

/**
 * Preview user avatar
 *
 * Uses picture from auth token if available to avoid DB query.
 * If avatar is an external URL, redirects to it.
 * Returns default avatar on any error (for img tag compatibility).
 *
 * @route   GET /api/profile/avatar
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function previewAvatar(req, res) {
  const fs = req.app.get('fs');

  // Default avatar URL (can be configured via env)
  const defaultAvatar =
    process.env.RSK_DEFAULT_AVATAR_URL ||
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
    const avatarPath = req.query.fileName || req.user.picture;

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
 * @route   DELETE /api/profile/avatar
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function removeAvatar(req, res) {
  const http = req.app.get('http');
  const fs = req.app.get('fs');

  try {
    // Get user with profile to find current avatar
    const user = await profileService.getUserWithProfile(req.user.id, {
      models: req.app.get('models'),
      hook: req.app.get('hook').withContext(req.app)
    });

    if (!user) {
      return http.sendNotFound(res, 'User not found');
    }

    if (!user.profile || !user.profile.picture) {
      return http.sendValidationError(res, {
        avatar: 'No avatar to remove',
      });
    }

    // Delete the avatar file using fs.remove()
    try {
      if (user.profile.picture) {
        await fs.remove(user.profile.picture);
      }
    } catch (error) {
      // Log warning but continue - file may already be deleted
      console.warn('Failed to delete avatar file:', error.message);
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

    return http.sendServerError(res, 'Failed to change password');
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

    const preferences = await profileService.updateUserPreferences(
      req.user.id,
      { language, timezone, notifications, theme },
      {
        models: req.app.get('models'),
        webhook: req.app.get('webhook'),
        hook: req.app.get('hook').withContext(req.app)
      },
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
    const preferences = await profileService.getUserPreferences(
      req.user.id,
      {
        models: req.app.get('models'),
        hook: req.app.get('hook').withContext(req.app)
      }
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
      webhook: req.app.get('webhook'),
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

    return http.sendServerError(res, 'Failed to delete user');
  }
}
