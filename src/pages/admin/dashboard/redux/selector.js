/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { normalizeState, SLICE_NAME } from './slice';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getDashboardState = state => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  return normalized.data;
};

const getOperationState = (state, operationKey) => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  if (!normalized.operations) return null;
  return normalized.operations[operationKey] || null;
};

// =============================================================================
// DATA SELECTORS
// =============================================================================

/**
 * Get dashboard stats
 */
export const getDashboardStats = state => {
  const data = getDashboardState(state);
  return data && data.stats;
};

/**
 * Get recent activities
 */
export const getDashboardRecentActivities = state => {
  const data = getDashboardState(state);
  return (data && data.recentActivities) || [];
};

// =============================================================================
// FETCH OPERATION (fetchDashboard)
// =============================================================================

export const isDashboardLoading = state => {
  const op = getOperationState(state, 'fetch');
  return !!(op && op.loading);
};

export const getDashboardError = state => {
  const op = getOperationState(state, 'fetch');
  return (op && op.error) || null;
};
