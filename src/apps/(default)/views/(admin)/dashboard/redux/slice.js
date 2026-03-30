/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

import { fetchActivities } from './thunks';

// =============================================================================
// STATE SHAPE
// =============================================================================

const createOperationState = () => ({ loading: false, error: null });

/**
 * Create fresh operations object
 */
const createFreshOperations = () => ({
  fetch: { loading: true, error: null },
});

/**
 * Create fresh data object
 */
const createFreshData = () => ({
  activities: [],
  total: 0,
  pagination: null,
  initialized: {
    fetch: false, // Tracks if data has been fetched at least once
  },
});

/**
 * Create fresh initial state
 */
const createFreshState = () => ({
  data: createFreshData(),
  operations: createFreshOperations(),
});

/**
 * Normalize state - ensures consistent state shape.
 * This handles migration from old state format to new format.
 * Always clones operations to avoid SSR frozen state issues.
 * Exported for reuse in selectors.
 */
export const normalizeState = state => {
  // Handle null/undefined/non-object
  if (!state || typeof state !== 'object') {
    return {
      data: createFreshData(),
      operations: createFreshOperations(),
    };
  }

  // State already has proper structure - clone operations to ensure mutability
  if ('operations' in state) {
    return {
      data: state.data || createFreshData(),
      operations: { ...createFreshOperations(), ...state.operations },
    };
  }

  // Legacy state with 'activities' at root level (old format)
  if ('activities' in state) {
    return {
      data: {
        activities: state.activities || [],
        total: state.total || 0,
        initialized: {
          fetch: false,
        },
      },
      operations: createFreshOperations(),
    };
  }

  // Very old format or unknown - return fresh state
  return {
    data: createFreshData(),
    operations: createFreshOperations(),
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
 * Manages dashboard state including statistics and recent activities.
 */
const dashboardSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    /**
     * Clear error for fetch operation
     */
    clearDashboardError: state => {
      const normalized = normalizeState(state);
      normalized.operations.fetch.error = null;
      Object.assign(state, normalized);
    },

    /**
     * Reset to initial state
     */
    resetDashboardState: () => initialState,
  },
  extraReducers: builder => {
    builder
      // Fetch dashboard
      .addCase(fetchActivities.pending, createPendingHandler('fetch'))
      .addCase(fetchActivities.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        const { data, total, page, limit, offset, hasMore } = action.payload;

        // Store activities and total
        normalized.data.activities = data;
        normalized.data.total = total;

        // Store pagination metadata
        normalized.data.pagination = {
          total,
          page,
          limit,
          offset,
          hasMore,
        };

        normalized.data.initialized.fetch = true;
        normalized.operations.fetch = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchActivities.rejected, createRejectedHandler('fetch'));
  },
});

export const { clearDashboardError, resetDashboardState } =
  dashboardSlice.actions;

export default dashboardSlice.reducer;
