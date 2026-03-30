/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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

      const { data } = await fetch(`/api/extensions/hub?${query}`, {
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
      const { data } = await fetch('/api/extensions/hub/featured', {
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
      const { data } = await fetch('/api/extensions/hub/categories', {
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
  async (id, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/extensions/hub/${id}`);
      return data.listing;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

// ========================================================================
// Hub Submit Thunks
// ========================================================================

export const submitExtension = createAsyncThunk(
  'admin/hub/submitExtension',
  async (formData, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/extensions/hub/submit', {
        method: 'POST',
        body: formData,
      });
      return data.submission;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const fetchMySubmissions = createAsyncThunk(
  'admin/hub/fetchMySubmissions',
  async (options, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/extensions/hub/my', {
        signal: options && options.signal,
      });
      return data.submissions || [];
    } catch (error) {
      if (error.name === 'AbortError') return [];
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

// ========================================================================
// Hub Review Thunks
// ========================================================================

export const fetchSubmissions = createAsyncThunk(
  'admin/hub/fetchSubmissions',
  async (params, { extra: { fetch }, rejectWithValue }) => {
    try {
      const query = new URLSearchParams();
      if (params && params.status) query.set('status', params.status);
      if (params && params.page) query.set('page', params.page);

      const { data } = await fetch(
        `/api/admin/extensions/hub/submissions?${query}`,
        { signal: params && params.signal },
      );
      return data;
    } catch (error) {
      if (error.name === 'AbortError') return { submissions: [], total: 0 };
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const reviewSubmission = createAsyncThunk(
  'admin/hub/reviewSubmission',
  async ({ id, action, notes }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(
        `/api/admin/extensions/hub/submissions/${id}`,
        {
          method: 'PATCH',
          body: { action, notes },
        },
      );
      return data;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);
