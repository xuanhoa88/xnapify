/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';
import { verifyPassword } from '../utils/password';
import { DEFAULT_ROLE } from '../constants/roles';

// ========================================================================
// PROFILE MANAGEMENT SERVICES
// ========================================================================

/**
 * Get user with profile information
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} User with profile
 * @throws {Error} If UserNotFoundError
 */
export async function getUserWithProfile(user_id, models) {
  const { User, UserProfile, Role, Group } = models;

  const user = await User.findByPk(user_id, {
    include: [
      { model: UserProfile, as: 'profile' },
      {
        model: Role,
        as: 'roles',
        attributes: ['id', 'name', 'description'],
        through: { attributes: [] },
      },
      {
        model: Group,
        as: 'groups',
        attributes: ['id', 'name', 'description', 'category', 'type'],
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: 'roles',
            attributes: ['id', 'name', 'description'],
            through: { attributes: [] },
          },
        ],
      },
    ],
  });

  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  return user;
}

/**
 * Update user profile information
 *
 * @param {string} user_id - User ID
 * @param {Object} profileData - Profile data to update
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user with profile
 * @throws {Error} If UserNotFoundError
 */
export async function updateUserProfile(user_id, profileData, models) {
  const { User, UserProfile, Role, Group } = models;

  const user = await User.findByPk(user_id, {
    include: [
      { model: UserProfile, as: 'profile' },
      {
        model: Role,
        as: 'roles',
        attributes: ['id', 'name', 'description'],
        through: { attributes: [] },
      },
      {
        model: Group,
        as: 'groups',
        attributes: ['id', 'name', 'description', 'category', 'type'],
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: 'roles',
            attributes: ['id', 'name', 'description'],
            through: { attributes: [] },
          },
        ],
      },
    ],
  });

  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Update profile data
  if (user.profile) {
    await user.profile.update(profileData);
  } else {
    // Create profile if it doesn't exist
    await UserProfile.create({
      user_id,
      ...profileData,
    });
  }

  // Reload user with updated profile
  await user.reload({
    include: [{ model: UserProfile, as: 'profile' }],
  });

  return user;
}

/**
 * Upload user avatar
 *
 * @param {string} user_id - User ID
 * @param {Object} file - Uploaded file object
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} options.fs - Filesystem actions
 * @returns {Promise<Object>} Updated user with profile
 * @throws {Error} If UserNotFoundError or file invalid
 */
export async function uploadUserAvatar(user_id, file, { models, fs }) {
  // Get models from app context
  const { User, UserProfile } = models;

  // Find user by ID
  const user = await User.findByPk(user_id, {
    include: [{ model: UserProfile, as: 'profile' }],
  });

  // Check if user exists
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Store old avatar path for cleanup after successful upload
  const oldAvatarPath = user.profile && user.profile.picture;

  // Generate unique filename for avatar
  const timestamp = Date.now();
  const fileExtension = path.extname(file.originalname);
  const fileName = `avatar_${user_id}_${timestamp}${fileExtension}`;

  // Prepare file data for upload
  const fileData = {
    fileName,
    originalName: file.originalname,
    buffer: file.buffer,
    mimeType: file.mimetype,
    size: file.size,
  };

  // Upload file using filesystem actions
  const uploadResult = await fs.actions.uploadFile(fileData, {
    directory: 'avatars', // Store avatars in a dedicated directory
  });

  if (!uploadResult.success) {
    const error = new Error(uploadResult.message || 'Failed to upload avatar');
    error.name = 'FileUploadError';
    error.status = 400;
    throw error;
  }

  // Update profile with new avatar path
  const avatarPath = uploadResult.data.fileName;

  if (user.profile) {
    await user.profile.update({ picture: avatarPath });
  } else {
    await UserProfile.create({
      user_id,
      picture: avatarPath,
    });
  }

  // Delete old avatar AFTER successful upload and database update
  if (oldAvatarPath) {
    try {
      await fs.actions.deleteFile(oldAvatarPath);
    } catch (error) {
      // Log error but don't fail the operation if old file deletion fails
      console.warn('Failed to delete old avatar:', error.message);
    }
  }

  // Reload user with updated profile
  await user.reload({
    include: [{ model: UserProfile, as: 'profile' }],
  });

  return user;
}

/**
 * Link existing file as user avatar
 *
 * @param {string} user_id - User ID
 * @param {string} fileName - Uploaded file name
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} options.fs - Filesystem actions
 * @returns {Promise<Object>} Updated user with profile
 */
export async function linkUserAvatar(user_id, fileName, { models, fs }) {
  const { User, UserProfile } = models;

  // Verify user exists
  const user = await User.findByPk(user_id, {
    include: [{ model: UserProfile, as: 'profile' }],
  });

  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Store old avatar path for cleanup
  const oldAvatarPath = user.profile && user.profile.picture;

  // Update profile with new avatar path
  if (user.profile) {
    await user.profile.update({ picture: fileName });
  } else {
    await UserProfile.create({
      user_id,
      picture: fileName,
    });
  }

  // Delete old avatar if different
  if (oldAvatarPath && oldAvatarPath !== fileName) {
    try {
      await fs.actions.deleteFile(oldAvatarPath);
    } catch (error) {
      console.warn('Failed to delete old avatar:', error.message);
    }
  }

  // Reload user with updated profile
  await user.reload({
    include: [{ model: UserProfile, as: 'profile' }],
  });

  return user;
}

/**
 * Remove user avatar
 *
 * @param {string} user_id - User ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} options.fs - Filesystem actions
 * @returns {Promise<Object>} Updated user with profile
 * @throws {Error} If UserNotFoundError
 */
export async function removeUserAvatar(user_id, { models, fs }) {
  const { User, UserProfile } = models;

  const user = await User.findByPk(user_id, {
    include: [{ model: UserProfile, as: 'profile' }],
  });

  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  if (user.profile && user.profile.picture) {
    // Delete the avatar file from storage
    try {
      await fs.actions.deleteFile(user.profile.picture);
    } catch (error) {
      // Log error but don't fail the operation if file deletion fails
      console.warn('Failed to delete avatar file:', error.message);
    }

    // Update profile to remove avatar reference
    await user.profile.update({ picture: null });
  }

  // Reload user with updated profile
  await user.reload({
    include: [{ model: UserProfile, as: 'profile' }],
  });

  return user;
}

/**
 * Change user password
 *
 * @param {string} user_id - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} Success status
 * @throws {Error} If UserNotFoundError or password invalid
 */
export async function changeUserPassword(
  user_id,
  currentPassword,
  newPassword,
  { models },
) {
  const { User } = models;

  const user = await User.scope('withPassword').findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Verify current password
  const isValidPassword = await verifyPassword(currentPassword, user.password);
  if (!isValidPassword) {
    const error = new Error('Invalid current password');
    error.name = 'InvalidPasswordError';
    error.status = 400;
    throw error;
  }

  // Update password (hashed automatically by model hook)
  await user.update({ password: newPassword });

  return true;
}

/**
 * Get user activity log
 *
 * @param {string} user_id - User ID
 * @param {Object} options - Query options
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Activity log with pagination
 */
export async function getUserActivity(user_id, options, models) {
  const { page = 1, limit = 10 } = options;
  const offset = (page - 1) * limit;
  const { UserLogin } = models;

  if (!UserLogin) {
    return {
      activities: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
        pages: 0,
      },
    };
  }

  const { count, rows: activities } = await UserLogin.findAndCountAll({
    where: { user_id },
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['login_at', 'DESC']],
    attributes: ['id', 'ip_address', 'user_agent', 'login_at', 'success'],
  });

  return {
    activities,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  };
}

/**
 * Update user preferences
 *
 * @param {string} user_id - User ID
 * @param {Object} preferences - User preferences
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated preferences
 */
export async function updateUserPreferences(user_id, preferences, models) {
  const { UserProfile } = models;

  // Find or create user profile
  let profile = await UserProfile.findOne({ where: { user_id } });

  if (!profile) {
    profile = await UserProfile.create({
      user_id,
      preferences: preferences,
    });
  } else {
    // Merge with existing preferences
    const currentPreferences = profile.preferences || {};
    const updatedPreferences = { ...currentPreferences, ...preferences };

    await profile.update({ preferences: updatedPreferences });
  }

  return profile.preferences;
}

/**
 * Get user preferences
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} User preferences
 */
export async function getUserPreferences(user_id, models) {
  const { UserProfile } = models;

  const profile = await UserProfile.findOne({
    where: { user_id },
    attributes: ['preferences'],
  });

  return (
    (profile && profile.preferences) || {
      language: 'en',
      timezone: 'UTC',
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      theme: 'light',
    }
  );
}

/**
 * Delete user account
 *
 * @param {string} user_id - User ID
 * @param {string} password - User password for confirmation
 * @param {Object} {models, auth} - Database models and authentication engine
 * @returns {Promise<boolean>} Success status
 * @throws {Error} If UserNotFoundError or password invalid
 */
export async function deleteUserAccount(user_id, password, { models }) {
  const { User, UserProfile } = models;

  const user = await User.scope('withPassword').findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) {
    const error = new Error('Invalid password');
    error.name = 'InvalidPasswordError';
    error.status = 400;
    throw error;
  }

  // Delete user profile first (if exists)
  await UserProfile.destroy({ where: { user_id } });

  // Delete user (this will cascade to related records)
  await user.destroy();

  return true;
}

/**
 * Export user data (GDPR compliance)
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} User data export
 */
export async function exportUserData(user_id, models) {
  const { User, UserProfile, UserLogin, Role, Group } = models;

  const user = await User.findByPk(user_id, {
    include: [
      { model: UserProfile, as: 'profile' },
      {
        model: Role,
        as: 'roles',
        attributes: ['id', 'name', 'description'],
        through: { attributes: [] },
      },
      {
        model: Group,
        as: 'groups',
        attributes: ['id', 'name', 'description'],
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: 'roles',
            attributes: ['id', 'name', 'description'],
            through: { attributes: [] },
          },
        ],
      },
    ],
  });

  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Get login history
  const loginHistory = UserLogin
    ? await UserLogin.findAll({
        where: { user_id },
        attributes: ['ip_address', 'user_agent', 'login_at', 'success'],
        order: [['login_at', 'DESC']],
      })
    : [];

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      email_confirmed: user.email_confirmed,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      roles:
        Array.isArray(user.roles) && user.roles.length > 0
          ? user.roles.map(r => r.name)
          : [DEFAULT_ROLE],
      groups: user.groups || [],
    },
    profile: user.profile
      ? {
          display_name: user.profile.display_name,
          first_name: user.profile.first_name,
          last_name: user.profile.last_name,
          bio: user.profile.bio,
          location: user.profile.location,
          website: user.profile.website,
          picture: user.profile.picture,
          preferences: user.profile.preferences,
        }
      : null,
    loginHistory,
  };
}
