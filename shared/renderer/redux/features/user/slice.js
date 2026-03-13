/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

import {
  login,
  register,
  logout,
  me,
  refreshToken,
  resetPasswordRequest,
  resetPasswordConfirmation,
  emailVerification,
  updateUserProfile,
  uploadUserAvatar,
  changeUserPassword,
  deleteUser,
  getUserPreferences,
  updateUserPreferences,
} from './thunks';
import { initialState, normalizeState, createOperationState } from './utils';

/**
 * User Slice
 *
 * Manages user authentication state with per-operation loading/error tracking.
 *
 * State shape:
 * {
 *   data: { id, email, profile: { display_name, picture, language, ... }, role, ... } | null,
 *   operations: {
 *     auth: { loading: boolean, error: string | null },
 *     emailVerification: { loading: boolean, error: string | null },
 *     resetPassword: { loading: boolean, error: string | null },
 *     profile: { loading: boolean, error: string | null },
 *     avatar: { loading: boolean, error: string | null },
 *     password: { loading: boolean, error: string | null },
 *     delete: { loading: boolean, error: string | null },
 *     preferences: { loading: boolean, error: string | null },
 *   }
 * }
 */

/**
 * Create pending handler for a specific operation
 */
const createPendingHandler = operationKey => state => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = { loading: true, error: null };
  Object.assign(state, normalized);
};

/**
 * Create rejected handler for a specific operation
 */
const createRejectedHandler = operationKey => (state, action) => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = {
    loading: false,
    error:
      action.payload ||
      (action.error && action.error.message) ||
      'An error occurred',
  };
  Object.assign(state, normalized);
};

/**
 * Create fulfilled handler that clears operation loading state
 */
const createFulfilledHandler = operationKey => state => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = createOperationState();
  Object.assign(state, normalized);
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    /**
     * Clear error for a specific operation
     */
    clearAuthError: state => {
      const normalized = normalizeState(state);
      normalized.operations.auth.error = null;
      Object.assign(state, normalized);
    },
    clearEmailVerificationError: state => {
      const normalized = normalizeState(state);
      normalized.operations.emailVerification.error = null;
      Object.assign(state, normalized);
    },
    clearResetPasswordError: state => {
      const normalized = normalizeState(state);
      normalized.operations.resetPassword.error = null;
      Object.assign(state, normalized);
    },
    clearProfileError: state => {
      const normalized = normalizeState(state);
      normalized.operations.profile.error = null;
      Object.assign(state, normalized);
    },
    clearAvatarError: state => {
      const normalized = normalizeState(state);
      normalized.operations.avatar.error = null;
      Object.assign(state, normalized);
    },
    clearPasswordError: state => {
      const normalized = normalizeState(state);
      normalized.operations.password.error = null;
      Object.assign(state, normalized);
    },
    clearDeleteError: state => {
      const normalized = normalizeState(state);
      normalized.operations.delete.error = null;
      Object.assign(state, normalized);
    },
    clearPreferencesError: state => {
      const normalized = normalizeState(state);
      normalized.operations.preferences.error = null;
      Object.assign(state, normalized);
    },

    /**
     * Reset to initial state (used for SSR hydration edge cases)
     */
    resetUserState: () => initialState,
  },
  extraReducers: builder => {
    // =========================================================================
    // LOGIN (auth operation)
    // =========================================================================
    builder
      .addCase(login.pending, createPendingHandler('auth'))
      .addCase(login.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data = action.payload.user;
        normalized.operations.auth = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(login.rejected, createRejectedHandler('auth'));

    // =========================================================================
    // REGISTER (auth operation)
    // =========================================================================
    builder
      .addCase(register.pending, createPendingHandler('auth'))
      .addCase(register.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data = action.payload.user;
        normalized.operations.auth = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(register.rejected, createRejectedHandler('auth'));

    // =========================================================================
    // LOGOUT (auth operation)
    // =========================================================================
    builder
      .addCase(logout.pending, createPendingHandler('auth'))
      .addCase(logout.fulfilled, () => initialState)
      .addCase(logout.rejected, () => initialState); // Always clear on logout

    // =========================================================================
    // ME (auth operation)
    // =========================================================================
    builder
      .addCase(me.pending, createPendingHandler('auth'))
      .addCase(me.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data = action.payload.user;
        normalized.operations.auth = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(me.rejected, state => {
        // Don't store error for me() - failing to authenticate is expected for guests
        // We only want to show errors for explicit login/register actions
        const normalized = normalizeState(state);
        normalized.operations.auth = createOperationState();
        Object.assign(state, normalized);
      });

    // =========================================================================
    // REFRESH TOKEN (silent - no loading indicator)
    // =========================================================================
    builder
      .addCase(refreshToken.pending, state => {
        // Don't show loading for background token refresh
        const normalized = normalizeState(state);
        normalized.operations.auth.error = null;
        Object.assign(state, normalized);
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        if (action.payload.user) {
          normalized.data = action.payload.user;
        }
        Object.assign(state, normalized);
      })
      .addCase(refreshToken.rejected, createRejectedHandler('auth'));

    // =========================================================================
    // RESET PASSWORD REQUEST (resetPassword operation)
    // =========================================================================
    builder
      .addCase(
        resetPasswordRequest.pending,
        createPendingHandler('resetPassword'),
      )
      .addCase(
        resetPasswordRequest.fulfilled,
        createFulfilledHandler('resetPassword'),
      )
      .addCase(
        resetPasswordRequest.rejected,
        createRejectedHandler('resetPassword'),
      );

    // =========================================================================
    // RESET PASSWORD CONFIRMATION (resetPassword operation)
    // =========================================================================
    builder
      .addCase(
        resetPasswordConfirmation.pending,
        createPendingHandler('resetPassword'),
      )
      .addCase(
        resetPasswordConfirmation.fulfilled,
        createFulfilledHandler('resetPassword'),
      )
      .addCase(
        resetPasswordConfirmation.rejected,
        createRejectedHandler('resetPassword'),
      );

    // =========================================================================
    // EMAIL VERIFICATION (emailVerification operation)
    // =========================================================================
    builder
      .addCase(
        emailVerification.pending,
        createPendingHandler('emailVerification'),
      )
      .addCase(emailVerification.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data = action.payload.user;
        normalized.operations.emailVerification = {
          loading: false,
          error: null,
        };
        Object.assign(state, normalized);
      })
      .addCase(
        emailVerification.rejected,
        createRejectedHandler('emailVerification'),
      );

    // =========================================================================
    // UPDATE PROFILE (profile operation)
    // =========================================================================
    builder
      .addCase(updateUserProfile.pending, createPendingHandler('profile'))
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        if (normalized.data) {
          normalized.data = { ...normalized.data, ...action.payload.profile };
        } else {
          normalized.data = action.payload.profile;
        }
        normalized.operations.profile = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(updateUserProfile.rejected, createRejectedHandler('profile'));

    // =========================================================================
    // UPLOAD AVATAR (avatar operation)
    // =========================================================================
    builder
      .addCase(uploadUserAvatar.pending, createPendingHandler('avatar'))
      .addCase(uploadUserAvatar.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        if (normalized.data) {
          normalized.data.profile = {
            ...normalized.data.profile,
            picture: action.payload.picture,
          };
        }
        normalized.operations.avatar = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(uploadUserAvatar.rejected, createRejectedHandler('avatar'));

    // =========================================================================
    // CHANGE PASSWORD (password operation)
    // =========================================================================
    builder
      .addCase(changeUserPassword.pending, createPendingHandler('password'))
      .addCase(changeUserPassword.fulfilled, createFulfilledHandler('password'))
      .addCase(changeUserPassword.rejected, createRejectedHandler('password'));

    // =========================================================================
    // DELETE USER (delete operation)
    // =========================================================================
    builder
      .addCase(deleteUser.pending, createPendingHandler('delete'))
      .addCase(deleteUser.fulfilled, () => initialState)
      .addCase(deleteUser.rejected, createRejectedHandler('delete'));

    // =========================================================================
    // GET PREFERENCES (preferences operation)
    // =========================================================================
    builder
      .addCase(getUserPreferences.pending, createPendingHandler('preferences'))
      .addCase(getUserPreferences.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        if (normalized.data) {
          normalized.data.profile = {
            ...normalized.data.profile,
            ...action.payload.preferences,
          };
        }
        normalized.operations.preferences = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(
        getUserPreferences.rejected,
        createRejectedHandler('preferences'),
      );

    // =========================================================================
    // UPDATE PREFERENCES (preferences operation)
    // =========================================================================
    builder
      .addCase(
        updateUserPreferences.pending,
        createPendingHandler('preferences'),
      )
      .addCase(updateUserPreferences.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        if (normalized.data) {
          normalized.data.profile = {
            ...normalized.data.profile,
            ...action.payload.preferences,
          };
        }
        normalized.operations.preferences = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(
        updateUserPreferences.rejected,
        createRejectedHandler('preferences'),
      );
  },
});

export const {
  clearAuthError,
  clearEmailVerificationError,
  clearResetPasswordError,
  clearProfileError,
  clearAvatarError,
  clearPasswordError,
  clearDeleteError,
  clearPreferencesError,
  resetUserState,
} = userSlice.actions;

export default userSlice.reducer;
