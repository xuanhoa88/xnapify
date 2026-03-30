/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

import {
  fetchHubListings,
  fetchFeaturedListings,
  fetchCategories,
  fetchListingDetail,
  submitExtension,
  fetchMySubmissions,
  fetchSubmissions,
  reviewSubmission,
} from './thunks';

export const SLICE_NAME = 'hub';

const createOperationState = () => ({ loading: false, error: null });

const createFreshOperations = () => ({
  browse: createOperationState(),
  featured: createOperationState(),
  categories: createOperationState(),
  detail: createOperationState(),
  submit: createOperationState(),
  mySubmissions: createOperationState(),
  submissions: createOperationState(),
  review: createOperationState(),
});

const createFreshData = () => ({
  listings: [],
  featured: [],
  categories: [],
  selectedListing: null,
  total: 0,
  page: 1,
  totalPages: 0,
  mySubmissions: [],
  submissions: [],
  submissionsTotal: 0,
  initialized: false,
});

const initialState = {
  data: createFreshData(),
  filters: {
    search: '',
    category: 'all',
    sort: 'popular',
    page: 1,
  },
  operations: createFreshOperations(),
};

export const normalizeState = state => {
  if (!state || typeof state !== 'object') {
    return {
      data: createFreshData(),
      filters: initialState.filters,
      operations: createFreshOperations(),
    };
  }
  if ('operations' in state) {
    return {
      data: state.data || createFreshData(),
      filters: state.filters || initialState.filters,
      operations: { ...createFreshOperations(), ...state.operations },
    };
  }
  return {
    data: createFreshData(),
    filters: initialState.filters,
    operations: createFreshOperations(),
  };
};

const createPending = key => state => {
  state.operations[key] = { loading: true, error: null };
};

const createRejected = key => (state, action) => {
  const errorMsg =
    action.payload || (action.error && action.error.message) || 'Unknown error';
  state.operations[key] = { loading: false, error: errorMsg };
};

const hubSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    setFilter(state, action) {
      Object.assign(state.filters, action.payload);
    },
    setSelectedListing(state, action) {
      state.data.selectedListing = action.payload;
    },
    clearSelectedListing(state) {
      state.data.selectedListing = null;
    },
    resetHubState() {
      return { ...initialState, operations: createFreshOperations() };
    },
    clearBrowseError(state) {
      state.operations.browse.error = null;
    },
    clearSubmitError(state) {
      state.operations.submit.error = null;
    },
  },
  extraReducers: builder => {
    // Browse
    builder
      .addCase(fetchHubListings.pending, createPending('browse'))
      .addCase(fetchHubListings.fulfilled, (state, action) => {
        state.operations.browse = { loading: false, error: null };
        state.data.listings = action.payload.listings || [];
        state.data.total = action.payload.total || 0;
        state.data.page = action.payload.page || 1;
        state.data.totalPages = action.payload.totalPages || 0;
        state.data.initialized = true;
      })
      .addCase(fetchHubListings.rejected, createRejected('browse'));

    // Featured
    builder
      .addCase(fetchFeaturedListings.pending, createPending('featured'))
      .addCase(fetchFeaturedListings.fulfilled, (state, action) => {
        state.operations.featured = { loading: false, error: null };
        state.data.featured = action.payload;
      })
      .addCase(fetchFeaturedListings.rejected, createRejected('featured'));

    // Categories
    builder
      .addCase(fetchCategories.pending, createPending('categories'))
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.operations.categories = { loading: false, error: null };
        state.data.categories = action.payload;
      })
      .addCase(fetchCategories.rejected, createRejected('categories'));

    // Detail
    builder
      .addCase(fetchListingDetail.pending, createPending('detail'))
      .addCase(fetchListingDetail.fulfilled, (state, action) => {
        state.operations.detail = { loading: false, error: null };
        state.data.selectedListing = action.payload;
      })
      .addCase(fetchListingDetail.rejected, createRejected('detail'));

    // Submit
    builder
      .addCase(submitExtension.pending, createPending('submit'))
      .addCase(submitExtension.fulfilled, (state, action) => {
        state.operations.submit = { loading: false, error: null };
        state.data.mySubmissions.unshift(action.payload);
      })
      .addCase(submitExtension.rejected, createRejected('submit'));

    // My Submissions
    builder
      .addCase(fetchMySubmissions.pending, createPending('mySubmissions'))
      .addCase(fetchMySubmissions.fulfilled, (state, action) => {
        state.operations.mySubmissions = { loading: false, error: null };
        state.data.mySubmissions = action.payload;
      })
      .addCase(fetchMySubmissions.rejected, createRejected('mySubmissions'));

    // Admin Submissions
    builder
      .addCase(fetchSubmissions.pending, createPending('submissions'))
      .addCase(fetchSubmissions.fulfilled, (state, action) => {
        state.operations.submissions = { loading: false, error: null };
        state.data.submissions = action.payload.submissions || [];
        state.data.submissionsTotal = action.payload.total || 0;
      })
      .addCase(fetchSubmissions.rejected, createRejected('submissions'));

    // Review
    builder
      .addCase(reviewSubmission.pending, createPending('review'))
      .addCase(reviewSubmission.fulfilled, (state, action) => {
        state.operations.review = { loading: false, error: null };
        const submission = action.payload && action.payload.submission;
        const reviewedId = submission && submission.id;
        if (reviewedId) {
          state.data.submissions = state.data.submissions.filter(
            s => s.id !== reviewedId,
          );
        }
      })
      .addCase(reviewSubmission.rejected, createRejected('review'));
  },
});

export const {
  setFilter,
  setSelectedListing,
  clearSelectedListing,
  resetHubState,
  clearBrowseError,
  clearSubmitError,
} = hubSlice.actions;

export default hubSlice.reducer;
