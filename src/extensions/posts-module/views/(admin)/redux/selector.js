/**
 * Posts Selectors
 */

import { normalizeState, SLICE_NAME } from './slice';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getOperationState = (state, operationKey) => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  if (!normalized.operations) return null;
  return normalized.operations[operationKey] || null;
};

const getPostsState = state => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  return normalized.data;
};

// =============================================================================
// DATA SELECTORS
// =============================================================================

export const getPosts = state => {
  const data = getPostsState(state);
  return (data && data.posts) || [];
};

export const getPostsPagination = state => {
  const data = getPostsState(state);
  return (data && data.pagination) || null;
};

export const isPostsListInitialized = state => {
  const data = getPostsState(state);
  return !!(data && data.initialized && data.initialized.list);
};

// =============================================================================
// LIST OPERATION (fetchPosts)
// =============================================================================

export const isPostsListLoading = state => {
  const op = getOperationState(state, 'list');
  return !!(op && op.loading);
};

export const getPostsListError = state => {
  const op = getOperationState(state, 'list');
  return (op && op.error) || null;
};

// =============================================================================
// CREATE OPERATION (createPost)
// =============================================================================

export const isPostCreateLoading = state => {
  const op = getOperationState(state, 'create');
  return !!(op && op.loading);
};

export const getPostCreateError = state => {
  const op = getOperationState(state, 'create');
  return (op && op.error) || null;
};

// =============================================================================
// UPDATE OPERATION (updatePost)
// =============================================================================

export const isPostUpdateLoading = state => {
  const op = getOperationState(state, 'update');
  return !!(op && op.loading);
};

export const getPostUpdateError = state => {
  const op = getOperationState(state, 'update');
  return (op && op.error) || null;
};

// =============================================================================
// DELETE OPERATION (deletePost)
// =============================================================================

export const isPostDeleteLoading = state => {
  const op = getOperationState(state, 'delete');
  return !!(op && op.loading);
};

export const getPostDeleteError = state => {
  const op = getOperationState(state, 'delete');
  return (op && op.error) || null;
};
