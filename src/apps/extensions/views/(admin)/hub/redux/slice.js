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
  installFromHub,
  updateFromHub,
  uninstallFromHub,
} from './thunks.js';

export const SLICE_NAME = '@admin/hub';

const createOperationState = () => ({ loading: false, error: null });

const createFreshOperations = () => ({
  browse: createOperationState(),
  featured: createOperationState(),
  categories: createOperationState(),
  detail: createOperationState(),
  install: createOperationState(),
  update: createOperationState(),
  uninstall: createOperationState(),
});

const createFreshData = () => ({
  listings: [],
  featured: [],
  categories: [],
  selectedListing: null,
  total: 0,
  page: 1,
  totalPages: 0,
  initialized: false,
});

const initialState = {
  data: createFreshData(),
  filters: {
    search: '',
    category: 'all',
    sort: 'name',
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
    clearInstallError(state) {
      state.operations.install.error = null;
    },
    clearUpdateError(state) {
      state.operations.update.error = null;
    },
    clearUninstallError(state) {
      state.operations.uninstall.error = null;
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

    // Install from Hub
    builder
      .addCase(installFromHub.pending, createPending('install'))
      .addCase(installFromHub.fulfilled, (state, _action) => {
        state.operations.install = { loading: false, error: null };
      })
      .addCase(installFromHub.rejected, createRejected('install'));

    // Update from Hub
    builder
      .addCase(updateFromHub.pending, createPending('update'))
      .addCase(updateFromHub.fulfilled, (state, _action) => {
        state.operations.update = { loading: false, error: null };
      })
      .addCase(updateFromHub.rejected, createRejected('update'));

    // Uninstall from Hub
    builder
      .addCase(uninstallFromHub.pending, createPending('uninstall'))
      .addCase(uninstallFromHub.fulfilled, (state, _action) => {
        state.operations.uninstall = { loading: false, error: null };
      })
      .addCase(uninstallFromHub.rejected, createRejected('uninstall'));
  },
});

export const {
  setFilter,
  setSelectedListing,
  clearSelectedListing,
  resetHubState,
  clearBrowseError,
  clearInstallError,
  clearUpdateError,
  clearUninstallError,
} = hubSlice.actions;

export default hubSlice.reducer;
