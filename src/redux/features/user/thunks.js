/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * User Thunks
 *
 * Async thunk actions using Redux Toolkit's createAsyncThunk.
 * Each thunk automatically dispatches pending/fulfilled/rejected actions.
 *
 * Return values are available in the fulfilled action payload.
 * Errors are available in the rejected action payload via rejectWithValue.
 */

// =============================================================================
// AUTHENTICATION THUNKS
// =============================================================================

/**
 * Login user
 */
export const login = createAsyncThunk(
  'user/login',
  async (
    { email, password, rememberMe = false },
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch('/api/login', {
        method: 'POST',
        body: { email, password, rememberMe },
      });
      return { user: data.user, accessToken: data.accessToken };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Register new user
 */
export const register = createAsyncThunk(
  'user/register',
  async (
    { email, password, confirmPassword },
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch('/api/register', {
        method: 'POST',
        body: { email, password, confirmPassword },
      });
      return { user: data.user, accessToken: data.accessToken };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Logout user
 */
export const logout = createAsyncThunk(
  'user/logout',
  async (_, { extra: { fetch } }) => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // Ignore logout API errors - always clear state
    }
    return null;
  },
);

/**
 * Get current user
 */
export const me = createAsyncThunk(
  'user/me',
  async (_, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/me');
      return { user: data.user };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Refresh session tokens
 */
export const refreshToken = createAsyncThunk(
  'user/refreshToken',
  async (_, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/refresh-token', { method: 'POST' });
      return { user: (data && data.user) || null };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

// =============================================================================
// PASSWORD RESET THUNKS
// =============================================================================

/**
 * Reset password (request)
 */
export const resetPasswordRequest = createAsyncThunk(
  'user/resetPasswordRequest',
  async ({ email }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/users/reset-password/request', {
        method: 'POST',
        body: { email },
      });
      return { message: data.message };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Reset password confirmation
 */
export const resetPasswordConfirmation = createAsyncThunk(
  'user/resetPasswordConfirmation',
  async ({ token, password }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/users/password-reset/confirmation', {
        method: 'POST',
        body: { token, password },
      });
      return { message: data.message };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Generate a random secure password
 */
export const generatePassword = createAsyncThunk(
  'user/generatePassword',
  async (options = {}, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { length = 16, includeSymbols = true } = options;

      const { data } = await fetch(`/api/generate-password`, {
        query: { length, includeSymbols: includeSymbols ? undefined : 'false' },
      });

      return data.password;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Email verification
 */
export const emailVerification = createAsyncThunk(
  'user/emailVerification',
  async ({ token }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/users/email-verification', {
        method: 'POST',
        body: { token },
      });
      return {
        user: data.user,
        accessToken: data.accessToken,
        message: data.message,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

// =============================================================================
// PROFILE THUNKS
// =============================================================================

/**
 * Update user profile
 */
export const updateUserProfile = createAsyncThunk(
  'user/updateProfile',
  async (userData, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/profile', {
        method: 'PUT',
        body: userData,
      });
      return { profile: data.profile };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Upload user avatar
 */
export const uploadUserAvatar = createAsyncThunk(
  'user/uploadAvatar',
  async (file, { extra: { fetch }, rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('files', file);

      const { data } = await fetch('/api/fs/upload', {
        method: 'POST',
        body: formData,
      });

      if (data && data.successful.length > 0) {
        const uploadedFile = data.successful[0];

        // Link avatar to user profile
        const linkResponse = await fetch('/api/profile/avatar', {
          method: 'PUT',
          body: { fileName: uploadedFile.data.fileName },
        });

        if (linkResponse.data) {
          return { picture: linkResponse.data.profile.picture };
        }
      }

      return rejectWithValue('Upload failed');
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Change user password
 */
export const changeUserPassword = createAsyncThunk(
  'user/changePassword',
  async (
    { currentPassword, newPassword },
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch('/api/profile/password', {
        method: 'PUT',
        body: { currentPassword, newPassword },
      });
      return { message: data.message };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Delete current user
 */
export const deleteUser = createAsyncThunk(
  'user/delete',
  async (
    { password, confirmPassword },
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      await fetch('/api/profile', {
        method: 'DELETE',
        body: { password, confirmPassword },
      });
      return null;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

// =============================================================================
// PREFERENCES THUNKS
// =============================================================================

/**
 * Get user preferences
 */
export const getUserPreferences = createAsyncThunk(
  'user/getPreferences',
  async (_, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/profile/preferences', {
        method: 'GET',
      });
      return { preferences: data.preferences };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Update user preferences
 */
export const updateUserPreferences = createAsyncThunk(
  'user/updatePreferences',
  async (
    { language, timezone, notifications, theme },
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch('/api/profile/preferences', {
        method: 'PUT',
        body: { language, timezone, notifications, theme },
      });
      return { preferences: data.preferences };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);
