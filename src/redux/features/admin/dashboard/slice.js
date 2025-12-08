/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  stats: {
    totalUsers: 0,
    totalGroups: 0,
    totalPermissions: 0,
    totalRoles: 0,
    systemStatus: 'Unknown',
    uptime: '0%',
  },
  recentActivity: [],
  loading: false,
  error: null,
};

/**
 * Dashboard Slice
 *
 * Manages dashboard state including statistics and recent activity.
 */
const dashboardSlice = createSlice({
  name: 'admin/dashboard',
  initialState,
  reducers: {
    fetchDashboardStart: state => {
      state.loading = true;
      state.error = null;
    },
    fetchDashboardSuccess: (state, action) => {
      state.loading = false;
      state.stats = action.payload.stats || initialState.stats;
      state.recentActivity = action.payload.recentActivity || [];
      state.error = null;
    },
    fetchDashboardError: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const {
  fetchDashboardStart,
  fetchDashboardSuccess,
  fetchDashboardError,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;
