/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

// ========================================================================
// Hub Browse Thunks
// ========================================================================

export const fetchHubListings = createAsyncThunk(
  'admin/hub/fetchListings',
  async (params, { extra: { fetch }, rejectWithValue }) => {
    try {
      const query = new URLSearchParams();
      if (params && params.search) query.set('search', params.search);
      if (params && params.category) query.set('category', params.category);
      if (params && params.sort) query.set('sort', params.sort);
      if (params && params.page) query.set('page', params.page);
      if (params && params.limit) query.set('limit', params.limit);

      const { data } = await fetch(`/api/admin/extensions/hub?${query}`, {
        signal: params && params.signal,
      });
      return data;
    } catch (error) {
      if (error.name === 'AbortError') return { listings: [], total: 0 };
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const fetchFeaturedListings = createAsyncThunk(
  'admin/hub/fetchFeatured',
  async (options, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/extensions/hub/featured', {
        signal: options && options.signal,
      });
      return data.featured || [];
    } catch (error) {
      if (error.name === 'AbortError') return [];
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const fetchCategories = createAsyncThunk(
  'admin/hub/fetchCategories',
  async (options, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/extensions/hub/categories', {
        signal: options && options.signal,
      });
      return data.categories || [];
    } catch (error) {
      if (error.name === 'AbortError') return [];
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const fetchListingDetail = createAsyncThunk(
  'admin/hub/fetchListingDetail',
  async (name, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(
        `/api/admin/extensions/hub/${encodeURIComponent(name)}`,
      );
      return data.listing;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

// ========================================================================
// Hub Install Thunk
// ========================================================================

export const installFromHub = createAsyncThunk(
  'admin/hub/installFromHub',
  async (extensionName, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/extensions/hub/install', {
        method: 'POST',
        body: { name: extensionName },
      });
      return data.extension;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);
