/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSelector } from '@reduxjs/toolkit';

import { normalizeState } from './utils';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const selectUserRaw = state => state && state.user;

/**
 * Memoized normalized user state
 */
const getNormalizedUserState = createSelector([selectUserRaw], user =>
  normalizeState(user),
);

/**
 * Safely get nested property from state
 */
const getOperationState = (state, operationKey) => {
  const normalized = getNormalizedUserState(state);
  if (!normalized.operations) return null;
  return normalized.operations[operationKey] || null;
};

/**
 * Get user data from state (handles all formats)
 */
const getUserState = state => {
  const normalized = getNormalizedUserState(state);
  return normalized.data;
};

// =============================================================================
// USER DATA SELECTORS
// =============================================================================

/**
 * Check if user is authenticated
 */
export const isAuthenticated = state => {
  const user = getUserState(state);
  return !!(user && user.id);
};

/**
 * Get current user data
 */
export const getUserProfile = state => {
  return getUserState(state) || null;
};

/**
 * Get user ID
 */
export const getUserId = state => {
  const user = getUserState(state);
  return (user && user.id) || null;
};

/**
 * Get impersonator ID (if active)
 */
export const getImpersonatorId = state => {
  const normalized = getNormalizedUserState(state);
  return normalized.impersonatorId || null;
};

/**
 * Get user email
 */
export const getUserEmail = state => {
  const user = getUserState(state);
  return (user && user.email) || null;
};

/**
 * Get user display name
 */
export const getUserDisplayName = state => {
  const user = getUserState(state);
  if (!user) return null;
  const profile = user.profile || {};
  if (profile.display_name) return profile.display_name;
  return user.email;
};

/**
 * Get current user's avatar URL
 */
export const getUserAvatarUrl = state => {
  const user = getUserState(state);
  const picture = user && user.profile && user.profile.picture;
  if (!picture) return null;
  if (/^https?:\/\//i.test(picture)) return picture;
  return '/api/auth/profile/avatar?fileName=' + encodeURIComponent(picture);
};

/**
 * Get user preferences
 */
export const getUserPreferencesData = state => {
  const user = getUserState(state);
  if (!user || !user.profile) return null;
  const p = user.profile;
  // Preferences are now individual profile keys
  const prefs = {};
  if (p.language) prefs.language = p.language;
  if (p.timezone) prefs.timezone = p.timezone;
  if (p.theme) prefs.theme = p.theme;
  if (p.notifications) prefs.notifications = p.notifications;
  return Object.keys(prefs).length > 0 ? prefs : null;
};

/**
 * Get user roles
 */
const EMPTY_ROLES = [];
export const getUserRoles = state => {
  const user = getUserState(state);
  return (user && user.roles) || EMPTY_ROLES;
};

// =============================================================================
// AUTH OPERATION (login, register, logout, me, refreshToken)
// =============================================================================

export const isAuthLoading = state => {
  const op = getOperationState(state, 'auth');
  return !!(op && op.loading);
};

export const getAuthError = state => {
  const op = getOperationState(state, 'auth');
  return (op && op.error) || null;
};

// =============================================================================
// EMAIL VERIFICATION OPERATION
// =============================================================================

export const isEmailVerificationLoading = state => {
  const op = getOperationState(state, 'emailVerification');
  return !!(op && op.loading);
};

export const getEmailVerificationError = state => {
  const op = getOperationState(state, 'emailVerification');
  return (op && op.error) || null;
};

// =============================================================================
// RESET PASSWORD OPERATION (request + confirmation)
// =============================================================================

export const isResetPasswordLoading = state => {
  const op = getOperationState(state, 'resetPassword');
  return !!(op && op.loading);
};

export const getResetPasswordError = state => {
  const op = getOperationState(state, 'resetPassword');
  return (op && op.error) || null;
};

// =============================================================================
// PROFILE OPERATION (updateUserProfile)
// =============================================================================

export const isProfileLoading = state => {
  const op = getOperationState(state, 'profile');
  return !!(op && op.loading);
};

export const getProfileError = state => {
  const op = getOperationState(state, 'profile');
  return (op && op.error) || null;
};

// =============================================================================
// AVATAR OPERATION (uploadUserAvatar)
// =============================================================================

export const isAvatarLoading = state => {
  const op = getOperationState(state, 'avatar');
  return !!(op && op.loading);
};

export const getAvatarError = state => {
  const op = getOperationState(state, 'avatar');
  return (op && op.error) || null;
};

// =============================================================================
// PASSWORD OPERATION (changeUserPassword)
// =============================================================================

export const isPasswordLoading = state => {
  const op = getOperationState(state, 'password');
  return !!(op && op.loading);
};

export const getPasswordError = state => {
  const op = getOperationState(state, 'password');
  return (op && op.error) || null;
};

// =============================================================================
// DELETE OPERATION (deleteUser)
// =============================================================================

export const isDeleteLoading = state => {
  const op = getOperationState(state, 'delete');
  return !!(op && op.loading);
};

export const getDeleteError = state => {
  const op = getOperationState(state, 'delete');
  return (op && op.error) || null;
};

// =============================================================================
// PREFERENCES OPERATION (getUserPreferences, updateUserPreferences)
// =============================================================================

export const isPreferencesLoading = state => {
  const op = getOperationState(state, 'preferences');
  return !!(op && op.loading);
};

export const getPreferencesError = state => {
  const op = getOperationState(state, 'preferences');
  return (op && op.error) || null;
};

// =============================================================================
// DEPRECATED - Keep for backward compatibility (will be removed later)
// =============================================================================

/**
 * @deprecated Use operation-specific selectors instead (isAuthLoading, getAuthError, etc.)
 */
export const isUserLoading = state => {
  const normalized = getNormalizedUserState(state);
  if (!normalized.operations) {
    return false;
  }
  const ops = normalized.operations;
  return Object.values(ops).some(op => !!(op && op.loading));
};

/**
 * @deprecated Use operation-specific selectors instead
 */
export const getUserError = state => {
  const normalized = getNormalizedUserState(state);
  if (!normalized.operations) {
    return null;
  }
  const ops = normalized.operations;
  const values = Object.values(ops);
  for (let i = 0; i < values.length; i++) {
    if (values[i] && values[i].error) return values[i].error;
  }
  return null;
};
