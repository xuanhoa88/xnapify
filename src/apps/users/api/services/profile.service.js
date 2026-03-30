/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { userFullIncludes } from '../utils/includes';
import { verifyPassword } from '../utils/password';

// ========================================================================
// PROFILE MANAGEMENT SERVICES
// ========================================================================

/**
 * Get user with profile and RBAC information
 *
 * Centralized function for fetching user data with profile, roles, permissions,
 * and groups. Used by both auth and profile endpoints.
 *
 * @param {string} user_id - User ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @returns {Promise<Object>} User with profile and RBAC
 * @throws {Error} If UserNotFoundError
 */
export async function getUserWithProfile(user_id, { models }) {
  const { User } = models;

  const user = await User.findByPk(user_id, {
    include: userFullIncludes(models, {
      includePermissions: true,
      groupAttributes: ['id', 'name', 'description', 'category', 'type'],
    }),
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
 * @param {Object} formData - Form data to update
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} options.hook - Hook factory for activities logging
 * @returns {Promise<Object>} Updated user with profile
 * @throws {Error} If UserNotFoundError
 */
export async function updateUserProfile(user_id, formData, { models, hook }) {
  const { User, UserProfile } = models;

  const user = await User.findByPk(user_id, {
    include: userFullIncludes(models, {
      groupAttributes: ['id', 'name', 'description', 'category', 'type'],
    }),
  });

  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Run hooks before updating
  await hook('profile').emit('updating', formData, { user_id, user });

  // Update profile data via EAV bulk upserts
  const updates = [];
  const profileData = formData.profile || {};
  for (const [key, value] of Object.entries(profileData)) {
    if (value !== undefined) {
      updates.push({
        user_id,
        attribute_key: key,
        attribute_value: value,
      });
    }
  }

  if (updates.length > 0) {
    await UserProfile.bulkCreate(updates, {
      updateOnDuplicate: ['attribute_value'],
    });
  }

  // Re-fetch user with full profile (not reload, as reload skips afterFind hooks)
  const updatedUser = await getUserWithProfile(user_id, { models });

  // Run hooks after updating
  await hook('profile').emit('updated', { user_id, user: updatedUser });

  return updatedUser;
}

/**
 * Change user password
 *
 * @param {string} user_id - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} options.hook - Hook factory for activities logging
 * @returns {Promise<boolean>} Success status
 * @throws {Error} If UserNotFoundError or password invalid
 */
export async function changeUserPassword(
  user_id,
  currentPassword,
  newPassword,
  { models, hook },
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

  // Run hooks
  await hook('profile').emit('password_changed', {
    user,
    user_id,
    email: user.email,
  });

  return true;
}

/**
 * Update user preferences
 *
 * @param {string} user_id - User ID
 * @param {Object} preferences - User preferences
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} options.hook - Hook factory for activities logging
 * @returns {Promise<Object>} Updated preferences
 */
export async function updateUserPreferences(
  user_id,
  preferences,
  { models, hook },
) {
  const { UserProfile } = models;

  // Each preference key is stored as a separate EAV row
  const preferenceEntries = Object.entries(preferences).map(([key, value]) => ({
    user_id,
    attribute_key: key,
    attribute_value: value,
  }));

  if (preferenceEntries.length > 0) {
    await UserProfile.bulkCreate(preferenceEntries, {
      updateOnDuplicate: ['attribute_value'],
    });
  }

  // Run hooks
  await hook('profile').emit('preferences_updated', {
    user_id,
    preferences,
  });

  return preferences;
}

/**
 * Get user preferences
 *
 * @param {string} user_id - User ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} options.hook - Hook factory for activities logging
 * @returns {Promise<Object>} User preferences
 */
export async function getUserPreferences(user_id, { models, hook }) {
  const { UserProfile } = models;

  // Preference keys stored as individual EAV rows
  const prefKeys = ['language', 'timezone', 'theme', 'notifications'];
  const prefRows = await UserProfile.findAll({
    where: { user_id, attribute_key: prefKeys },
  });

  const preferences = {};
  prefRows.forEach(row => {
    preferences[row.attribute_key] = row.attribute_value;
  });

  await hook('profile').emit('preferences_retrieved', { preferences, user_id });

  return {
    language: preferences.language || 'en',
    timezone: preferences.timezone || 'UTC',
    notifications: preferences.notifications || {
      email: true,
      push: true,
      sms: false,
    },
    theme: preferences.theme || 'light',
  };
}

/**
 * Delete user account
 *
 * @param {string} user_id - User ID
 * @param {string} password - User password for confirmation
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} options.hook - Hook engine for activities logging
 * @returns {Promise<boolean>} Success status
 * @throws {Error} If UserNotFoundError or password invalid
 */
export async function deleteUserAccount(user_id, password, { models, hook }) {
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

  const userEmail = user.email;

  // Delete user profile first (if exists)
  await UserProfile.destroy({ where: { user_id } });

  // Delete user (this will cascade to related records)
  await user.destroy();

  // Run hooks
  await hook('profile').emit('account_deleted', {
    user_id,
    email: userEmail,
  });

  return true;
}
