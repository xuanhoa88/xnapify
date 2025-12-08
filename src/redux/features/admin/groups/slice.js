/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [],
  currentGroup: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  },
  loading: false,
  error: null,
};

/**
 * Groups Slice
 *
 * Manages groups state including list, pagination, and loading states
 */
const groupsSlice = createSlice({
  name: 'admin/groups',
  initialState,
  reducers: {
    // Fetch groups actions
    fetchGroupsStart: state => {
      state.loading = true;
      state.error = null;
    },
    fetchGroupsSuccess: (state, action) => {
      state.items = action.payload.groups;
      state.pagination = action.payload.pagination;
      state.loading = false;
      state.error = null;
    },
    fetchGroupsError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Fetch single group actions
    fetchGroupStart: state => {
      state.loading = true;
      state.error = null;
    },
    fetchGroupSuccess: (state, action) => {
      state.currentGroup = action.payload;
      state.loading = false;
      state.error = null;
    },
    fetchGroupError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Create group actions
    createGroupStart: state => {
      state.loading = true;
      state.error = null;
    },
    createGroupSuccess: (state, action) => {
      state.items.unshift(action.payload);
      state.loading = false;
      state.error = null;
    },
    createGroupError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Update group actions
    updateGroupStart: state => {
      state.loading = true;
      state.error = null;
    },
    updateGroupSuccess: (state, action) => {
      const index = state.items.findIndex(g => g.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
      if (state.currentGroup?.id === action.payload.id) {
        state.currentGroup = action.payload;
      }
      state.loading = false;
      state.error = null;
    },
    updateGroupError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Delete group actions
    deleteGroupStart: state => {
      state.loading = true;
      state.error = null;
    },
    deleteGroupSuccess: (state, action) => {
      state.items = state.items.filter(g => g.id !== action.payload);
      if (state.currentGroup?.id === action.payload) {
        state.currentGroup = null;
      }
      state.loading = false;
      state.error = null;
    },
    deleteGroupError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Clear error
    clearGroupsError: state => {
      state.error = null;
    },
  },
});

export const {
  fetchGroupsStart,
  fetchGroupsSuccess,
  fetchGroupsError,
  fetchGroupStart,
  fetchGroupSuccess,
  fetchGroupError,
  createGroupStart,
  createGroupSuccess,
  createGroupError,
  updateGroupStart,
  updateGroupSuccess,
  updateGroupError,
  deleteGroupStart,
  deleteGroupSuccess,
  deleteGroupError,
  clearGroupsError,
} = groupsSlice.actions;

export default groupsSlice.reducer;
