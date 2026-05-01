/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSelector } from '@reduxjs/toolkit';

import { normalizeState, SLICE_NAME } from './slice';

const selectRawSlice = state => state && state[SLICE_NAME];

const getHubState = createSelector([selectRawSlice], raw =>
  normalizeState(raw),
);

const getOp = (state, key) => {
  const s = getHubState(state);
  const ops = s.operations || {};
  return ops[key] || { loading: false, error: null };
};

// Data selectors
export const getHubListings = state => getHubState(state).data.listings;

export const getHubFeatured = state => getHubState(state).data.featured;

export const getHubCategories = state => getHubState(state).data.categories;

export const getSelectedListing = state =>
  getHubState(state).data.selectedListing;

export const getHubTotal = state => getHubState(state).data.total;

export const getHubPage = state => getHubState(state).data.page;

export const getHubTotalPages = state => getHubState(state).data.totalPages;

export const isHubInitialized = state => getHubState(state).data.initialized;

// Filter selectors
export const getHubFilters = state => getHubState(state).filters;

// Operation selectors
export const isHubBrowseLoading = state => getOp(state, 'browse').loading;

export const isHubFeaturedLoading = state => getOp(state, 'featured').loading;

export const isHubCategoriesLoading = state =>
  getOp(state, 'categories').loading;

export const isHubDetailLoading = state => getOp(state, 'detail').loading;

export const isHubInstalling = state => getOp(state, 'install').loading;

export const getHubBrowseError = state => getOp(state, 'browse').error;

export const getHubInstallError = state => getOp(state, 'install').error;
