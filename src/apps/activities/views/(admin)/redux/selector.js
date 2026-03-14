/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Redux Selectors
 */

import { createSelector } from '@reduxjs/toolkit';

import { SLICE_NAME } from './slice';

const selectBase = state => state[SLICE_NAME];

export const getActivities = createSelector(
  selectBase,
  state => (state && state.items) || [],
);

export const getActivitiesPagination = createSelector(
  selectBase,
  state =>
    (state && state.pagination) || { total: 0, page: 1, limit: 20, pages: 0 },
);

export const isActivitiesLoading = createSelector(
  selectBase,
  state => !!(state && state.loading),
);

export const isActivitiesInitialized = createSelector(
  selectBase,
  state => !!(state && state.initialized),
);

export const getActivitiesError = createSelector(
  selectBase,
  state => state && state.error,
);
