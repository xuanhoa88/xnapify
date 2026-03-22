/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { normalizeState, SLICE_NAME } from './slice';

const getHubState = state => normalizeState(state && state[SLICE_NAME]);

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

export const getMySubmissions = state => getHubState(state).data.mySubmissions;

export const getAdminSubmissions = state => getHubState(state).data.submissions;

export const isHubInitialized = state => getHubState(state).data.initialized;

// Filter selectors
export const getHubFilters = state => getHubState(state).filters;

// Operation selectors
export const isHubBrowseLoading = state => getOp(state, 'browse').loading;

export const isHubFeaturedLoading = state => getOp(state, 'featured').loading;

export const isHubCategoriesLoading = state =>
  getOp(state, 'categories').loading;

export const isHubDetailLoading = state => getOp(state, 'detail').loading;

export const isHubSubmitting = state => getOp(state, 'submit').loading;

export const isMySubmissionsLoading = state =>
  getOp(state, 'mySubmissions').loading;

export const isAdminSubmissionsLoading = state =>
  getOp(state, 'submissions').loading;

export const isReviewLoading = state => getOp(state, 'review').loading;

export const getHubBrowseError = state => getOp(state, 'browse').error;

export const getHubSubmitError = state => getOp(state, 'submit').error;
