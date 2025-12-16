/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  users: [],
  pagination: null,
  loading: false,
  error: null,
  // User permissions state
  permissions: {
    userId: null,
    items: [],
    loading: false,
    error: null,
  },
};

/**
 * Users Management Slice
 *
 * Manages admin users list, CRUD operations, and user status updates
 */
const usersSlice = createSlice({
  name: 'admin/users',
  initialState,
  reducers: {
    // Fetch users list
    fetchUsersStart: state => {
      state.loading = true;
      state.error = null;
    },
    fetchUsersSuccess: (state, action) => {
      state.loading = false;
      state.users = action.payload.users || [];
      state.pagination = action.payload.pagination || null;
      state.error = null;
    },
    fetchUsersError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Fetch single user
    fetchUserByIdStart: state => {
      state.loading = true;
      state.error = null;
    },
    fetchUserByIdSuccess: state => {
      state.loading = false;
      state.error = null;
    },
    fetchUserByIdError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Delete user
    deleteUserStart: state => {
      state.loading = true;
      state.error = null;
    },
    deleteUserSuccess: (state, action) => {
      state.loading = false;
      state.users = state.users.filter(user => user.id !== action.payload);
      state.error = null;
    },
    deleteUserError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Update user status
    updateUserStatusStart: state => {
      state.loading = true;
      state.error = null;
    },
    updateUserStatusSuccess: (state, action) => {
      state.loading = false;
      const index = state.users.findIndex(u => u.id === action.payload.id);
      if (index !== -1) {
        state.users[index] = { ...state.users[index], ...action.payload };
      }
      state.error = null;
    },
    updateUserStatusError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Create user
    createUserStart: state => {
      state.loading = true;
      state.error = null;
    },
    createUserSuccess: (state, action) => {
      state.loading = false;
      state.users.unshift(action.payload);
      state.error = null;
    },
    createUserError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Update user
    updateUserByIdStart: state => {
      state.loading = true;
      state.error = null;
    },
    updateUserByIdSuccess: (state, action) => {
      state.loading = false;
      const index = state.users.findIndex(u => u.id === action.payload.id);
      if (index !== -1) {
        state.users[index] = { ...state.users[index], ...action.payload };
      }
      state.error = null;
    },
    updateUserByIdError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Fetch user permissions
    fetchUserPermissionsStart: (state, action) => {
      state.permissions.userId = action.payload;
      state.permissions.loading = true;
      state.permissions.error = null;
    },
    fetchUserPermissionsSuccess: (state, action) => {
      state.permissions.loading = false;
      state.permissions.items = action.payload;
      state.permissions.error = null;
    },
    fetchUserPermissionsError: (state, action) => {
      state.permissions.loading = false;
      state.permissions.error = action.payload;
    },
    clearUserPermissions: state => {
      state.permissions = initialState.permissions;
    },
  },
});

export const {
  fetchUsersStart,
  fetchUsersSuccess,
  fetchUsersError,
  fetchUserByIdStart,
  fetchUserByIdSuccess,
  fetchUserByIdError,
  deleteUserStart,
  deleteUserSuccess,
  deleteUserError,
  updateUserStatusStart,
  updateUserStatusSuccess,
  updateUserStatusError,
  createUserStart,
  createUserSuccess,
  createUserError,
  updateUserByIdStart,
  updateUserByIdSuccess,
  updateUserByIdError,
  fetchUserPermissionsStart,
  fetchUserPermissionsSuccess,
  fetchUserPermissionsError,
  clearUserPermissions,
} = usersSlice.actions;

export default usersSlice.reducer;
