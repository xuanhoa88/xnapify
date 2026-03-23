/**
 * Posts Thunks
 *
 * Async thunk actions for admin posts CRUD operations.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

import { SLICE_NAME } from './slice';

/**
 * Fetch posts with pagination and optional status filter
 */
export const fetchPosts = createAsyncThunk(
  `${SLICE_NAME}/fetchPosts`,
  async (options = {}, { extra: { fetch }, rejectWithValue, signal }) => {
    try {
      const { page = 1, limit = 20, status = '' } = options || {};

      const { data } = await fetch('/api/admin/posts', {
        query: {
          page,
          limit,
          status: status || undefined,
        },
        signal,
      });

      return data;
    } catch (error) {
      return rejectWithValue(error.data || error.message);
    }
  },
);

/**
 * Create a new post
 */
export const createPost = createAsyncThunk(
  `${SLICE_NAME}/createPost`,
  async (postData, { dispatch, extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/posts', {
        method: 'POST',
        body: postData,
      });

      dispatch(fetchPosts());

      return data.post;
    } catch (error) {
      return rejectWithValue(error.data || error.message);
    }
  },
);

/**
 * Update an existing post
 */
export const updatePost = createAsyncThunk(
  `${SLICE_NAME}/updatePost`,
  async (
    { postId, postData },
    { dispatch, extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch(`/api/admin/posts/${postId}`, {
        method: 'PUT',
        body: postData,
      });

      dispatch(fetchPosts());

      return data.post;
    } catch (error) {
      return rejectWithValue(error.data || error.message);
    }
  },
);

/**
 * Delete a post by ID
 */
export const deletePost = createAsyncThunk(
  `${SLICE_NAME}/deletePost`,
  async (postId, { extra: { fetch }, rejectWithValue }) => {
    try {
      await fetch(`/api/admin/posts/${postId}`, {
        method: 'DELETE',
      });

      return postId;
    } catch (error) {
      return rejectWithValue(error.data || error.message);
    }
  },
);
