/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';
import { fetchDashboard } from './thunks';

// =============================================================================
// STATE SHAPE
// =============================================================================

/**
 * Default dashboard state values
 */
const DEFAULT_DASHBOARD_DATA = Object.freeze({
  stats: {
    totalUsers: 0,
    totalGroups: 0,
    totalPermissions: 0,
    totalRoles: 0,
    systemStatus: 'Unknown',
    uptime: '0%',
  },
  recentActivities: [],
});

/**
 * Create fresh initial state
 */
const createFreshState = () => ({
  data: { ...DEFAULT_DASHBOARD_DATA },
  operations: {
    fetch: { loading: false, error: null },
  },
});

/**
 * Normalize state - ensures consistent state shape
 */
export const normalizeState = state => {
  if (!state) return createFreshState();

  return {
    data: state.data || { ...DEFAULT_DASHBOARD_DATA },
    operations: state.operations || {
      fetch: { loading: false, error: null },
    },
  };
};

const initialState = createFreshState();

// =============================================================================
// SLICE DEFINITION
// =============================================================================

/**
 * Dashboard Slice
 *
 * Manages dashboard state including statistics and recent activity.
 */
const dashboardSlice = createSlice({
  name: 'admin/dashboard',
  initialState,
  reducers: {
    clearDashboardError: state => {
      if (state.operations) {
        state.operations.fetch.error = null;
      }
    },
  },
  extraReducers: builder => {
    builder
      // Fetch dashboard
      .addCase(fetchDashboard.pending, state => {
        state.operations.fetch.loading = true;
        state.operations.fetch.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.operations.fetch.loading = false;
        state.operations.fetch.error = null;
        state.data.stats = action.payload.stats || DEFAULT_DASHBOARD_DATA.stats;
        state.data.recentActivities = action.payload.recentActivities || [];
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.operations.fetch.loading = false;
        state.operations.fetch.error = action.payload || action.error.message;
      });
  },
});

export const { clearDashboardError } = dashboardSlice.actions;

export default dashboardSlice.reducer;
