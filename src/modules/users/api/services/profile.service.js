/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { verifyPassword } from '../utils/password';
import { logUserActivity } from '../utils/activity';

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
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {Object} [options.hook] - Hook engine for activity logging
 * @returns {Promise<Object>} Updated user with profile
 * @throws {Error} If UserNotFoundError
 */
export async function updateUserProfile(
  user_id,
  profileData,
  { models, webhook, hook },
) {
  const profileHooks = hook('profile');

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

  // Run hooks
  await profileHooks.emit('updated', { user_id, profileData });

  // Log activity
  await logUserActivity(webhook, 'profile_updated', user_id);

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
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {Object} [options.hook] - Hook engine for activity logging
 * @returns {Promise<boolean>} Success status
 * @throws {Error} If UserNotFoundError or password invalid
 */
export async function changeUserPassword(
  user_id,
  currentPassword,
  newPassword,
  { models, webhook, hook },
) {
  const profileHooks = hook('profile');

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
  await profileHooks.emit('password_changed', { user_id });

  // Log activity
  await logUserActivity(webhook, 'password_changed', user_id);

  return true;
}

/**
 * Update user preferences
 *
 * @param {string} user_id - User ID
 * @param {Object} preferences - User preferences
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {Object} [options.hook] - Hook engine for activity logging
 * @returns {Promise<Object>} Updated preferences
 */
export async function updateUserPreferences(
  user_id,
  preferences,
  { models, webhook, hook },
) {
  const profileHooks = hook('profile');
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

  // Run hooks
  await profileHooks.emit('preferences_updated', { user_id, preferences });

  // Log activity
  await logUserActivity(webhook, 'preferences_updated', user_id);

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
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} options.hook - Hook engine for activity logging
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @returns {Promise<boolean>} Success status
 * @throws {Error} If UserNotFoundError or password invalid
 */
export async function deleteUserAccount(
  user_id,
  password,
  { models, webhook, hook },
) {
  const profileHooks = hook('profile');
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
  await profileHooks.emit('account_deleted', { user_id, email: userEmail });

  // Log activity
  await logUserActivity(webhook, 'account_deleted', user_id, {
    email: userEmail,
  });

  return true;
}
