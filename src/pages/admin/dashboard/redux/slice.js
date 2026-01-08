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

const createOperationState = () => ({ loading: false, error: null });

/**
 * Create fresh operations object
 */
const createFreshOperations = () => ({
  fetch: createOperationState(),
});

/**
 * Create fresh initial state
 */
const createFreshState = () => ({
  data: { ...DEFAULT_DASHBOARD_DATA },
  operations: createFreshOperations(),
});

/**
 * Normalize state - ensures consistent state shape
 */
export const normalizeState = state => {
  if (!state || typeof state !== 'object') {
    return createFreshState();
  }

  return {
    data: state.data || { ...DEFAULT_DASHBOARD_DATA },
    operations: { ...createFreshOperations(), ...state.operations },
  };
};

const initialState = createFreshState();

// =============================================================================
// HANDLER FACTORIES
// =============================================================================

/**
 * Create pending handler for a specific operation
 */
const createPendingHandler = operationKey => state => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = { loading: true, error: null };
  Object.assign(state, normalized);
};

/**
 * Create rejected handler for a specific operation
 */
const createRejectedHandler = operationKey => (state, action) => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = {
    loading: false,
    error:
      action.payload ||
      (action.error && action.error.message) ||
      'An error occurred',
  };
  Object.assign(state, normalized);
};

// =============================================================================
// SLICE DEFINITION
// =============================================================================

/**
 * Slice name constant - used for reducer injection and selectors
 */
export const SLICE_NAME = '@admin/dashboard';

/**
 * Dashboard Slice
 *
 * Manages dashboard state including statistics and recent activity.
 */
const dashboardSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    clearDashboardError: state => {
      const normalized = normalizeState(state);
      normalized.operations.fetch.error = null;
      Object.assign(state, normalized);
    },
  },
  extraReducers: builder => {
    builder
      // Fetch dashboard
      .addCase(fetchDashboard.pending, createPendingHandler('fetch'))
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.stats =
          action.payload.stats || DEFAULT_DASHBOARD_DATA.stats;
        normalized.data.recentActivities =
          action.payload.recentActivities || [];
        normalized.operations.fetch = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchDashboard.rejected, createRejectedHandler('fetch'));
  },
});

export const { clearDashboardError } = dashboardSlice.actions;

export default dashboardSlice.reducer;
