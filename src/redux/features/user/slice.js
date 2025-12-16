/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

/**
 * User Slice
 *
 * Manages user authentication state.
 * User state is set during SSR from req.user (JWT token).
 *
 * State shape when authenticated:
 * {
 *   id: string,
 *   email: string,
 *   display_name: string,
 *   role: string,  // 'admin', 'user', etc.
 *   is_admin: boolean,  // Optional flag
 *   // ... other user properties from JWT
 * }
 */
const userSlice = createSlice({
  name: 'user',
  // Initial state: null = not authenticated, object = authenticated user data
  initialState: null,
  reducers: {
    // Login actions
    loginStart: () => null, // No state change needed for start
    loginSuccess: (state, action) => action.payload,
    loginError: () => null, // Keep current state on error

    // Register actions
    registerStart: () => null,
    registerSuccess: (state, action) => action.payload,
    registerError: () => null,

    // Logout action
    logout: () => null,

    // Fetch user actions
    fetchUserStart: state => state, // Keep current state
    fetchUserSuccess: (state, action) => action.payload,
    fetchUserError: () => null,

    // Reset password actions (don't affect user state)
    resetPasswordStart: state => state,
    resetPasswordSuccess: state => state,
    resetPasswordError: state => state,

    // Reset password confirmation actions (don't affect user state)
    resetPasswordConfirmationStart: state => state,
    resetPasswordConfirmationSuccess: state => state,
    resetPasswordConfirmationError: state => state,

    // Email verification actions (don't affect user state)
    emailVerificationStart: state => state,
    emailVerificationSuccess: state => state,
    emailVerificationError: state => state,

    // Update user
    updateUser: (state, action) => {
      if (!state) return action.payload;
      return { ...state, ...action.payload };
    },

    // Update user avatar only
    updateUserAvatar: (state, action) => {
      if (!state) return state;
      return { ...state, picture: action.payload };
    },
  },
});

export const {
  loginStart,
  loginSuccess,
  loginError,
  registerStart,
  registerSuccess,
  registerError,
  logout,
  fetchUserStart,
  fetchUserSuccess,
  fetchUserError,
  resetPasswordStart,
  resetPasswordSuccess,
  resetPasswordError,
  resetPasswordConfirmationStart,
  resetPasswordConfirmationSuccess,
  resetPasswordConfirmationError,
  emailVerificationStart,
  emailVerificationSuccess,
  emailVerificationError,
  updateUser,
  updateUserAvatar,
} = userSlice.actions;

export default userSlice.reducer;
