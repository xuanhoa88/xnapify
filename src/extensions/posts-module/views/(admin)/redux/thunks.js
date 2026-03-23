/**
 * Posts Thunks
 *
 * Async thunk actions for admin posts CRUD operations.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Fetch posts with pagination and optional status filter
 */
export const fetchPosts = createAsyncThunk(
  'admin/posts/fetchPosts',
  async (options = {}, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { page = 1, limit = 20, status = '' } = options || {};

      const { data } = await fetch('/api/admin/posts', {
        query: {
          page,
          limit,
          status: status || undefined,
        },
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
  'admin/posts/createPost',
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
  'admin/posts/updatePost',
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
  'admin/posts/deletePost',
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
