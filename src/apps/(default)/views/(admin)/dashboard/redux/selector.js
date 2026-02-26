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

/**
 * Get dashboard data from state
 */
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
 * Get all activities
 */
export const getActivities = state => {
  const data = getDashboardState(state);
  return (data && data.activities) || [];
};

/**
 * Get activities total count
 */
export const getActivitiesTotal = state => {
  const data = getDashboardState(state);
  return (data && data.total) || 0;
};

/**
 * Check if activities has been fetched at least once
 */
export const isActivitiesInitialized = state => {
  const data = getDashboardState(state);
  return !!(data && data.initialized && data.initialized.fetch);
};

// =============================================================================
// FETCH OPERATION (fetchActivities)
// =============================================================================

export const isActivitiesLoading = state => {
  const op = getOperationState(state, 'fetch');
  return !!(op && op.loading);
};

export const getActivitiesError = state => {
  const op = getOperationState(state, 'fetch');
  return (op && op.error) || null;
};

/**
 * Get activities pagination metadata
 */
export const getActivitiesPagination = state => {
  const data = getDashboardState(state);
  return (data && data.pagination) || null;
};
