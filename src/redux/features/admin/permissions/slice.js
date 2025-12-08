/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  permissions: [],
  pagination: null,
  loading: false,
  error: null,
};

/**
 * Permissions Slice
 *
 * Manages permissions state including list, pagination, and loading states
 */
const permissionsSlice = createSlice({
  name: 'admin/permissions',
  initialState,
  reducers: {
    // Fetch actions
    fetchPermissionsStart: state => {
      state.loading = true;
      state.error = null;
    },
    fetchPermissionsSuccess: (state, action) => {
      state.loading = false;
      state.permissions = action.payload.permissions || [];
      state.pagination = action.payload.pagination || null;
      state.error = null;
    },
    fetchPermissionsError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Delete actions
    deletePermissionStart: state => {
      state.loading = true;
      state.error = null;
    },
    deletePermissionSuccess: (state, action) => {
      state.loading = false;
      state.permissions = state.permissions.filter(
        p => p.id !== action.payload,
      );
      state.error = null;
    },
    deletePermissionError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Create actions
    createPermissionStart: state => {
      state.loading = true;
      state.error = null;
    },
    createPermissionSuccess: (state, action) => {
      state.loading = false;
      state.permissions.push(action.payload);
      state.error = null;
    },
    createPermissionError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Update actions
    updatePermissionStart: state => {
      state.loading = true;
      state.error = null;
    },
    updatePermissionSuccess: (state, action) => {
      state.loading = false;
      const index = state.permissions.findIndex(
        p => p.id === action.payload.id,
      );
      if (index !== -1) {
        state.permissions[index] = action.payload;
      }
      state.error = null;
    },
    updatePermissionError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const {
  fetchPermissionsStart,
  fetchPermissionsSuccess,
  fetchPermissionsError,
  deletePermissionStart,
  deletePermissionSuccess,
  deletePermissionError,
  createPermissionStart,
  createPermissionSuccess,
  createPermissionError,
  updatePermissionStart,
  updatePermissionSuccess,
  updatePermissionError,
} = permissionsSlice.actions;

export default permissionsSlice.reducer;
