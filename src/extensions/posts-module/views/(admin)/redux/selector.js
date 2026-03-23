/**
 * Posts Selectors
 */

import { createSelector } from '@reduxjs/toolkit';

import { SLICE_NAME } from './slice';

// =============================================================================
// STABLE DEFAULTS (referentially stable to prevent re-renders)
// =============================================================================

const EMPTY_ARRAY = [];
const DEFAULT_DATA = { posts: EMPTY_ARRAY, pagination: null, initialized: {} };
const DEFAULT_OPERATIONS = {};

// =============================================================================
// BASE SELECTORS (raw state access)
// =============================================================================

const getSlice = state => state && state[SLICE_NAME];

const getPostsData = createSelector(
  getSlice,
  slice => (slice && slice.data) || DEFAULT_DATA,
);

const getOperations = createSelector(
  getSlice,
  slice => (slice && slice.operations) || DEFAULT_OPERATIONS,
);

// =============================================================================
// DATA SELECTORS
// =============================================================================

export const getPosts = createSelector(
  getPostsData,
  data => data.posts || EMPTY_ARRAY,
);

export const getPostsPagination = createSelector(
  getPostsData,
  data => data.pagination || null,
);

export const isPostsListInitialized = createSelector(
  getPostsData,
  data => !!(data.initialized && data.initialized.list),
);

// =============================================================================
// LIST OPERATION (fetchPosts)
// =============================================================================

export const isPostsListLoading = createSelector(
  getOperations,
  ops => !!(ops.list && ops.list.loading),
);

export const getPostsListError = createSelector(
  getOperations,
  ops => (ops.list && ops.list.error) || null,
);

// =============================================================================
// CREATE OPERATION (createPost)
// =============================================================================

export const isPostCreateLoading = createSelector(
  getOperations,
  ops => !!(ops.create && ops.create.loading),
);

export const getPostCreateError = createSelector(
  getOperations,
  ops => (ops.create && ops.create.error) || null,
);

// =============================================================================
// UPDATE OPERATION (updatePost)
// =============================================================================

export const isPostUpdateLoading = createSelector(
  getOperations,
  ops => !!(ops.update && ops.update.loading),
);

export const getPostUpdateError = createSelector(
  getOperations,
  ops => (ops.update && ops.update.error) || null,
);

// =============================================================================
// DELETE OPERATION (deletePost)
// =============================================================================

export const isPostDeleteLoading = createSelector(
  getOperations,
  ops => !!(ops.delete && ops.delete.loading),
);

export const getPostDeleteError = createSelector(
  getOperations,
  ops => (ops.delete && ops.delete.error) || null,
);
