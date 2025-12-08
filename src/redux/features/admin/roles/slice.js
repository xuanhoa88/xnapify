/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  roles: [],
  pagination: null,
  loading: false,
  error: null,
};

/**
 * Roles Slice
 *
 * Manages roles state including list, pagination, and loading states
 */
const rolesSlice = createSlice({
  name: 'admin/roles',
  initialState,
  reducers: {
    // Fetch actions
    fetchRolesStart: state => {
      state.loading = true;
      state.error = null;
    },
    fetchRolesSuccess: (state, action) => {
      state.loading = false;
      state.roles = action.payload.roles || [];
      state.pagination = action.payload.pagination || null;
      state.error = null;
    },
    fetchRolesError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Delete actions
    deleteRoleStart: state => {
      state.loading = true;
      state.error = null;
    },
    deleteRoleSuccess: (state, action) => {
      state.loading = false;
      state.roles = state.roles.filter(role => role.id !== action.payload);
      state.error = null;
    },
    deleteRoleError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Create actions
    createRoleStart: state => {
      state.loading = true;
      state.error = null;
    },
    createRoleSuccess: (state, action) => {
      state.loading = false;
      state.roles.push(action.payload);
      state.error = null;
    },
    createRoleError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Update actions
    updateRoleStart: state => {
      state.loading = true;
      state.error = null;
    },
    updateRoleSuccess: (state, action) => {
      state.loading = false;
      const index = state.roles.findIndex(
        role => role.id === action.payload.id,
      );
      if (index !== -1) {
        state.roles[index] = action.payload;
      }
      state.error = null;
    },
    updateRoleError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const {
  fetchRolesStart,
  fetchRolesSuccess,
  fetchRolesError,
  deleteRoleStart,
  deleteRoleSuccess,
  deleteRoleError,
  createRoleStart,
  createRoleSuccess,
  createRoleError,
  updateRoleStart,
  updateRoleSuccess,
  updateRoleError,
} = rolesSlice.actions;

export default rolesSlice.reducer;
