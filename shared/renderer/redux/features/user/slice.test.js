/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import reducer, {
  clearAuthError,
  clearEmailVerificationError,
  clearResetPasswordError,
  clearProfileError,
  clearAvatarError,
  clearPasswordError,
  clearDeleteError,
  clearPreferencesError,
  resetUserState,
} from './slice';
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
import { normalizeState } from './utils';

describe('[user] slice.js', () => {
  describe('normalizeState', () => {
    it('should handle null state', () => {
      const result = normalizeState(null);
      expect(result).toEqual({
        data: null,
        operations: expect.objectContaining({
          auth: { loading: false, error: null },
          emailVerification: { loading: false, error: null },
          resetPassword: { loading: false, error: null },
          profile: { loading: false, error: null },
          avatar: { loading: false, error: null },
          password: { loading: false, error: null },
          delete: { loading: false, error: null },
          preferences: { loading: false, error: null },
        }),
      });
    });

    it('should handle undefined state', () => {
      const result = normalizeState(undefined);
      expect(result.data).toBeNull();
      expect(result.operations).toBeDefined();
    });

    it('should handle state with proper structure', () => {
      const state = {
        data: { id: 1, email: 'test@example.com' },
        operations: {
          auth: { loading: true, error: null },
        },
      };
      const result = normalizeState(state);
      expect(result.data).toEqual({ id: 1, email: 'test@example.com' });
      expect(result.operations.auth).toEqual({ loading: true, error: null });
    });

    it('should handle legacy state with data key', () => {
      const state = {
        data: { id: 1, email: 'test@example.com' },
        loading: true,
      };
      const result = normalizeState(state);
      expect(result.data).toEqual({ id: 1, email: 'test@example.com' });
      expect(result.operations).toBeDefined();
    });

    it('should handle very old format (user data directly)', () => {
      const state = { id: 1, email: 'test@example.com' };
      const result = normalizeState(state);
      expect(result.data).toEqual({ id: 1, email: 'test@example.com' });
      expect(result.operations).toBeDefined();
    });

    it('should clone operations to ensure mutability', () => {
      const state = {
        data: { id: 1 },
        operations: {
          auth: { loading: false, error: null },
        },
      };
      const result = normalizeState(state);
      // Ensure operations is a new object
      expect(result.operations).not.toBe(state.operations);
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = reducer(undefined, { type: '@@INIT' });
      expect(state).toEqual({
        data: null,
        operations: expect.objectContaining({
          auth: { loading: false, error: null },
          emailVerification: { loading: false, error: null },
          resetPassword: { loading: false, error: null },
          profile: { loading: false, error: null },
          avatar: { loading: false, error: null },
          password: { loading: false, error: null },
          delete: { loading: false, error: null },
          preferences: { loading: false, error: null },
        }),
      });
    });
  });

  describe('Synchronous Actions', () => {
    let state;

    beforeEach(() => {
      state = {
        data: { id: 1, email: 'test@example.com' },
        operations: {
          auth: { loading: false, error: 'Auth error' },
          emailVerification: { loading: false, error: 'Verification error' },
          resetPassword: { loading: false, error: 'Reset error' },
          profile: { loading: false, error: 'Profile error' },
          avatar: { loading: false, error: 'Avatar error' },
          password: { loading: false, error: 'Password error' },
          delete: { loading: false, error: 'Delete error' },
          preferences: { loading: false, error: 'Preferences error' },
        },
      };
    });

    it('should clear auth error', () => {
      const newState = reducer(state, clearAuthError());
      expect(newState.operations.auth.error).toBeNull();
      expect(newState.operations.emailVerification.error).toBe(
        'Verification error',
      );
    });

    it('should clear email verification error', () => {
      const newState = reducer(state, clearEmailVerificationError());
      expect(newState.operations.emailVerification.error).toBeNull();
      expect(newState.operations.auth.error).toBe('Auth error');
    });

    it('should clear reset password error', () => {
      const newState = reducer(state, clearResetPasswordError());
      expect(newState.operations.resetPassword.error).toBeNull();
    });

    it('should clear profile error', () => {
      const newState = reducer(state, clearProfileError());
      expect(newState.operations.profile.error).toBeNull();
    });

    it('should clear avatar error', () => {
      const newState = reducer(state, clearAvatarError());
      expect(newState.operations.avatar.error).toBeNull();
    });

    it('should clear password error', () => {
      const newState = reducer(state, clearPasswordError());
      expect(newState.operations.password.error).toBeNull();
    });

    it('should clear delete error', () => {
      const newState = reducer(state, clearDeleteError());
      expect(newState.operations.delete.error).toBeNull();
    });

    it('should clear preferences error', () => {
      const newState = reducer(state, clearPreferencesError());
      expect(newState.operations.preferences.error).toBeNull();
    });

    it('should reset to initial state', () => {
      const newState = reducer(state, resetUserState());
      expect(newState.data).toBeNull();
      expect(newState.operations.auth.error).toBeNull();
    });
  });

  describe('Login Thunk', () => {
    it('should set loading on login pending', () => {
      const state = reducer(undefined, login.pending('requestId', {}));
      expect(state.operations.auth.loading).toBe(true);
      expect(state.operations.auth.error).toBeNull();
    });

    it('should set user data on login fulfilled', () => {
      const user = { id: 1, email: 'test@example.com', display_name: 'Test' };
      const state = reducer(
        undefined,
        login.fulfilled({ user }, 'requestId', {}),
      );
      expect(state.data).toEqual(user);
      expect(state.operations.auth.loading).toBe(false);
      expect(state.operations.auth.error).toBeNull();
    });

    it('should set error on login rejected', () => {
      const state = reducer(
        undefined,
        login.rejected(
          new Error('Login failed'),
          'requestId',
          {},
          'Login failed',
        ),
      );
      expect(state.operations.auth.loading).toBe(false);
      expect(state.operations.auth.error).toBe('Login failed');
    });
  });

  describe('Register Thunk', () => {
    it('should set loading on register pending', () => {
      const state = reducer(undefined, register.pending('requestId', {}));
      expect(state.operations.auth.loading).toBe(true);
    });

    it('should set user data on register fulfilled', () => {
      const user = { id: 2, email: 'new@example.com' };
      const state = reducer(
        undefined,
        register.fulfilled({ user }, 'requestId', {}),
      );
      expect(state.data).toEqual(user);
      expect(state.operations.auth.loading).toBe(false);
    });

    it('should set error on register rejected', () => {
      const state = reducer(
        undefined,
        register.rejected(
          new Error('Register failed'),
          'requestId',
          {},
          'Register failed',
        ),
      );
      expect(state.operations.auth.error).toBe('Register failed');
    });
  });

  describe('Logout Thunk', () => {
    let state;

    beforeEach(() => {
      state = {
        data: { id: 1, email: 'test@example.com' },
        operations: {
          auth: { loading: false, error: null },
          emailVerification: { loading: false, error: null },
          resetPassword: { loading: false, error: null },
          profile: { loading: false, error: null },
          avatar: { loading: false, error: null },
          password: { loading: false, error: null },
          delete: { loading: false, error: null },
          preferences: { loading: false, error: null },
        },
      };
    });

    it('should set loading on logout pending', () => {
      const newState = reducer(state, logout.pending('requestId'));
      expect(newState.operations.auth.loading).toBe(true);
    });

    it('should reset to initial state on fulfilled', () => {
      const newState = reducer(state, logout.fulfilled(undefined, 'requestId'));
      expect(newState.data).toBeNull();
      expect(newState.operations.auth.loading).toBe(false);
    });

    it('should reset to initial state even on rejected', () => {
      const newState = reducer(
        state,
        logout.rejected(new Error('Logout failed'), 'requestId'),
      );
      expect(newState.data).toBeNull();
    });
  });

  describe('Me Thunk', () => {
    it('should set loading on me pending', () => {
      const state = reducer(undefined, me.pending('requestId'));
      expect(state.operations.auth.loading).toBe(true);
    });

    it('should set user data on me fulfilled', () => {
      const user = { id: 1, email: 'test@example.com' };
      const state = reducer(undefined, me.fulfilled({ user }, 'requestId'));
      expect(state.data).toEqual(user);
      expect(state.operations.auth.loading).toBe(false);
    });

    it('should NOT set error on rejected (silent failure)', () => {
      const state = reducer(
        undefined,
        me.rejected(new Error('Unauthorized'), 'requestId'),
      );
      expect(state.operations.auth.loading).toBe(false);
      expect(state.operations.auth.error).toBeNull();
    });
  });

  describe('Refresh Token Thunk', () => {
    it('should NOT set loading on pending (silent refresh)', () => {
      const state = reducer(undefined, refreshToken.pending('requestId'));
      expect(state.operations.auth.loading).toBe(false);
      expect(state.operations.auth.error).toBeNull();
    });

    it('should update user data on refresh token fulfilled', () => {
      const user = { id: 1, email: 'test@example.com' };
      const state = reducer(
        undefined,
        refreshToken.fulfilled({ user }, 'requestId'),
      );
      expect(state.data).toEqual(user);
    });

    it('should set error on refresh token rejected', () => {
      const state = reducer(
        undefined,
        refreshToken.rejected(
          new Error('Token expired'),
          'requestId',
          undefined,
          'Token expired',
        ),
      );
      expect(state.operations.auth.error).toBe('Token expired');
    });
  });

  describe('Reset Password Request Thunk', () => {
    it('should set loading on reset password request pending', () => {
      const state = reducer(
        undefined,
        resetPasswordRequest.pending('requestId', {}),
      );
      expect(state.operations.resetPassword.loading).toBe(true);
    });

    it('should clear loading on fulfilled', () => {
      const state = reducer(
        undefined,
        resetPasswordRequest.fulfilled(undefined, 'requestId', {}),
      );
      expect(state.operations.resetPassword.loading).toBe(false);
      expect(state.operations.resetPassword.error).toBeNull();
    });

    it('should set error on reset password request rejected', () => {
      const state = reducer(
        undefined,
        resetPasswordRequest.rejected(
          new Error('Failed'),
          'requestId',
          {},
          'Failed',
        ),
      );
      expect(state.operations.resetPassword.error).toBe('Failed');
    });
  });

  describe('Reset Password Confirmation Thunk', () => {
    it('should set loading on reset password confirmation pending', () => {
      const state = reducer(
        undefined,
        resetPasswordConfirmation.pending('requestId', {}),
      );
      expect(state.operations.resetPassword.loading).toBe(true);
    });

    it('should clear loading on fulfilled', () => {
      const state = reducer(
        undefined,
        resetPasswordConfirmation.fulfilled(undefined, 'requestId', {}),
      );
      expect(state.operations.resetPassword.loading).toBe(false);
    });
  });

  describe('Email Verification Thunk', () => {
    it('should set loading on email verification pending', () => {
      const state = reducer(
        undefined,
        emailVerification.pending('requestId', {}),
      );
      expect(state.operations.emailVerification.loading).toBe(true);
    });

    it('should update user data on email verification fulfilled', () => {
      const user = { id: 1, email: 'test@example.com', email_verified: true };
      const state = reducer(
        undefined,
        emailVerification.fulfilled({ user }, 'requestId', {}),
      );
      expect(state.data).toEqual(user);
      expect(state.operations.emailVerification.loading).toBe(false);
    });

    it('should set error on email verification rejected', () => {
      const state = reducer(
        undefined,
        emailVerification.rejected(
          new Error('Invalid token'),
          'requestId',
          {},
          'Invalid token',
        ),
      );
      expect(state.operations.emailVerification.error).toBe('Invalid token');
    });
  });

  describe('Update Profile Thunk', () => {
    it('should set loading on update profile pending', () => {
      const state = reducer(
        undefined,
        updateUserProfile.pending('requestId', {}),
      );
      expect(state.operations.profile.loading).toBe(true);
    });

    it('should merge profile data on fulfilled', () => {
      const initialState = {
        data: { id: 1, email: 'test@example.com', display_name: 'Old Name' },
        operations: {
          auth: { loading: false, error: null },
          emailVerification: { loading: false, error: null },
          resetPassword: { loading: false, error: null },
          profile: { loading: false, error: null },
          avatar: { loading: false, error: null },
          password: { loading: false, error: null },
          delete: { loading: false, error: null },
          preferences: { loading: false, error: null },
        },
      };
      const profile = { display_name: 'New Name' };
      const state = reducer(
        initialState,
        updateUserProfile.fulfilled({ profile }, 'requestId', {}),
      );
      expect(state.data.display_name).toBe('New Name');
      expect(state.data.email).toBe('test@example.com');
      expect(state.operations.profile.loading).toBe(false);
    });

    it('should set profile data when user data is null', () => {
      const profile = { id: 1, display_name: 'Name' };
      const state = reducer(
        undefined,
        updateUserProfile.fulfilled({ profile }, 'requestId', {}),
      );
      expect(state.data).toEqual(profile);
    });
  });

  describe('Upload Avatar Thunk', () => {
    it('should set loading on upload avatar pending', () => {
      const state = reducer(
        undefined,
        uploadUserAvatar.pending('requestId', {}),
      );
      expect(state.operations.avatar.loading).toBe(true);
    });

    it('should update picture in profile on fulfilled', () => {
      const initialState = {
        data: {
          id: 1,
          email: 'test@example.com',
          profile: { display_name: 'Test' },
        },
        operations: {
          auth: { loading: false, error: null },
          emailVerification: { loading: false, error: null },
          resetPassword: { loading: false, error: null },
          profile: { loading: false, error: null },
          avatar: { loading: false, error: null },
          password: { loading: false, error: null },
          delete: { loading: false, error: null },
          preferences: { loading: false, error: null },
        },
      };
      const picture = 'https://example.com/avatar.jpg';
      const state = reducer(
        initialState,
        uploadUserAvatar.fulfilled({ picture }, 'requestId', {}),
      );
      expect(state.data.profile.picture).toBe(picture);
      expect(state.data.profile.display_name).toBe('Test');
      expect(state.operations.avatar.loading).toBe(false);
    });
  });

  describe('Change Password Thunk', () => {
    it('should set loading on change password pending', () => {
      const state = reducer(
        undefined,
        changeUserPassword.pending('requestId', {}),
      );
      expect(state.operations.password.loading).toBe(true);
    });

    it('should clear loading on fulfilled without modifying data', () => {
      const initialState = {
        data: { id: 1, email: 'test@example.com' },
        operations: {
          auth: { loading: false, error: null },
          emailVerification: { loading: false, error: null },
          resetPassword: { loading: false, error: null },
          profile: { loading: false, error: null },
          avatar: { loading: false, error: null },
          password: { loading: false, error: null },
          delete: { loading: false, error: null },
          preferences: { loading: false, error: null },
        },
      };
      const state = reducer(
        initialState,
        changeUserPassword.fulfilled(undefined, 'requestId', {}),
      );
      expect(state.data).toEqual(initialState.data);
      expect(state.operations.password.loading).toBe(false);
    });
  });

  describe('Delete User Thunk', () => {
    it('should set loading on delete user pending', () => {
      const state = reducer(undefined, deleteUser.pending('requestId'));
      expect(state.operations.delete.loading).toBe(true);
    });

    it('should reset to initial state on fulfilled', () => {
      const initialState = {
        data: { id: 1, email: 'test@example.com' },
        operations: {
          auth: { loading: false, error: null },
          emailVerification: { loading: false, error: null },
          resetPassword: { loading: false, error: null },
          profile: { loading: false, error: null },
          avatar: { loading: false, error: null },
          password: { loading: false, error: null },
          delete: { loading: false, error: null },
          preferences: { loading: false, error: null },
        },
      };
      const state = reducer(
        initialState,
        deleteUser.fulfilled(undefined, 'requestId'),
      );
      expect(state.data).toBeNull();
    });
  });

  describe('Get Preferences Thunk', () => {
    it('should set loading on get preferences pending', () => {
      const state = reducer(undefined, getUserPreferences.pending('requestId'));
      expect(state.operations.preferences.loading).toBe(true);
    });

    it('should merge preferences into profile on fulfilled', () => {
      const initialState = {
        data: {
          id: 1,
          email: 'test@example.com',
          profile: { display_name: 'Test' },
        },
        operations: {
          auth: { loading: false, error: null },
          emailVerification: { loading: false, error: null },
          resetPassword: { loading: false, error: null },
          profile: { loading: false, error: null },
          avatar: { loading: false, error: null },
          password: { loading: false, error: null },
          delete: { loading: false, error: null },
          preferences: { loading: false, error: null },
        },
      };
      const preferences = { theme: 'dark', language: 'en' };
      const state = reducer(
        initialState,
        getUserPreferences.fulfilled({ preferences }, 'requestId'),
      );
      expect(state.data.profile.theme).toBe('dark');
      expect(state.data.profile.language).toBe('en');
      expect(state.data.profile.display_name).toBe('Test');
      expect(state.operations.preferences.loading).toBe(false);
    });
  });

  describe('Update Preferences Thunk', () => {
    it('should set loading on update preferences pending', () => {
      const state = reducer(
        undefined,
        updateUserPreferences.pending('requestId', {}),
      );
      expect(state.operations.preferences.loading).toBe(true);
    });

    it('should merge updated preferences into profile on fulfilled', () => {
      const initialState = {
        data: {
          id: 1,
          email: 'test@example.com',
          profile: { display_name: 'Test', theme: 'light' },
        },
        operations: {
          auth: { loading: false, error: null },
          emailVerification: { loading: false, error: null },
          resetPassword: { loading: false, error: null },
          profile: { loading: false, error: null },
          avatar: { loading: false, error: null },
          password: { loading: false, error: null },
          delete: { loading: false, error: null },
          preferences: { loading: false, error: null },
        },
      };
      const preferences = { theme: 'dark', language: 'en' };
      const state = reducer(
        initialState,
        updateUserPreferences.fulfilled({ preferences }, 'requestId', {}),
      );
      expect(state.data.profile.theme).toBe('dark');
      expect(state.data.profile.language).toBe('en');
      expect(state.data.profile.display_name).toBe('Test');
    });
  });
});
