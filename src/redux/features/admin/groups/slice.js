/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [],
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
  clearGroupsError,
} = groupsSlice.actions;

export default groupsSlice.reducer;
