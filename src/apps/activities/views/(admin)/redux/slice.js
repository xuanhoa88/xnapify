/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Redux Slice
 */

import { createSlice } from '@reduxjs/toolkit';

import { fetchActivities } from './thunks';

export const SLICE_NAME = 'activities';

const initialState = {
  items: [],
  pagination: {
    total: 0,
    page: 1,
    limit: 20,
    pages: 0,
  },
  loading: false,
  initialized: false,
  error: null,
};

const activitiesSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    resetActivitiesState: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchActivities.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActivities.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        const payload = action.payload || {};
        state.items = payload.items || [];
        state.pagination = payload.pagination || initialState.pagination;
      })
      .addCase(fetchActivities.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          (action.error && action.error.message) ||
          'Failed to fetch activities';
      });
  },
});

export const { resetActivitiesState } = activitiesSlice.actions;
export default activitiesSlice.reducer;
