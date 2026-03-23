/**
 * Admin Posts Slice
 *
 * Manages admin posts list and CRUD operations
 * with per-operation loading/error tracking.
 *
 * State shape:
 * {
 *   data: {
 *     posts: [...],
 *     pagination: { total, page, limit, pages } | null,
 *     initialized: { list: boolean },
 *   },
 *   operations: {
 *     list:   { loading: boolean, error: string | null },
 *     create: { loading: boolean, error: string | null },
 *     update: { loading: boolean, error: string | null },
 *     delete: { loading: boolean, error: string | null },
 *   }
 * }
 */

import { createSlice } from '@reduxjs/toolkit';

import { fetchPosts, createPost, updatePost, deletePost } from './thunks';

const createOperationState = () => ({ loading: false, error: null });

const createFreshOperations = () => ({
  list: createOperationState(),
  create: createOperationState(),
  update: createOperationState(),
  delete: createOperationState(),
});

const createFreshData = () => ({
  posts: [],
  pagination: null,
  initialized: {
    list: false,
  },
});

const initialState = {
  data: createFreshData(),
  operations: createFreshOperations(),
};

/**
 * Normalize state to ensure it has the expected shape.
 * Handles SSR frozen state by cloning operations.
 */
export const normalizeState = state => {
  if (!state || typeof state !== 'object') {
    return {
      data: createFreshData(),
      operations: createFreshOperations(),
    };
  }

  if ('operations' in state) {
    return {
      data: state.data || createFreshData(),
      operations: { ...createFreshOperations(), ...state.operations },
    };
  }

  return {
    data: createFreshData(),
    operations: createFreshOperations(),
  };
};

const createPendingHandler = operationKey => state => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = { loading: true, error: null };
  Object.assign(state, normalized);
};

const createRejectedHandler = operationKey => (state, action) => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = {
    loading: false,
    error:
      action.payload ||
      (action.error && action.error.message) ||
      'An error occurred',
  };
  Object.assign(state, normalized);
};

/**
 * Slice name constant — used for reducer injection and selectors
 */
export const SLICE_NAME = '@admin/posts';

const postsSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    clearPostsListError: state => {
      const normalized = normalizeState(state);
      normalized.operations.list.error = null;
      Object.assign(state, normalized);
    },
    clearPostCreateError: state => {
      const normalized = normalizeState(state);
      normalized.operations.create.error = null;
      Object.assign(state, normalized);
    },
    clearPostUpdateError: state => {
      const normalized = normalizeState(state);
      normalized.operations.update.error = null;
      Object.assign(state, normalized);
    },
    clearPostDeleteError: state => {
      const normalized = normalizeState(state);
      normalized.operations.delete.error = null;
      Object.assign(state, normalized);
    },
    resetPostsState: () => initialState,
  },
  extraReducers: builder => {
    // FETCH POSTS LIST
    builder
      .addCase(fetchPosts.pending, createPendingHandler('list'))
      .addCase(fetchPosts.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.posts = action.payload.posts || [];
        normalized.data.pagination = action.payload.pagination || null;
        normalized.data.initialized.list = true;
        normalized.operations.list = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchPosts.rejected, createRejectedHandler('list'));

    // CREATE POST
    builder
      .addCase(createPost.pending, createPendingHandler('create'))
      .addCase(createPost.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.posts.unshift(action.payload);
        normalized.operations.create = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(createPost.rejected, createRejectedHandler('create'));

    // UPDATE POST
    builder
      .addCase(updatePost.pending, createPendingHandler('update'))
      .addCase(updatePost.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        const index = normalized.data.posts.findIndex(
          p => p.id === action.payload.id,
        );
        if (index !== -1) {
          normalized.data.posts[index] = {
            ...normalized.data.posts[index],
            ...action.payload,
          };
        }
        normalized.operations.update = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(updatePost.rejected, createRejectedHandler('update'));

    // DELETE POST
    builder
      .addCase(deletePost.pending, createPendingHandler('delete'))
      .addCase(deletePost.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.posts = normalized.data.posts.filter(
          p => p.id !== action.payload,
        );
        normalized.operations.delete = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(deletePost.rejected, createRejectedHandler('delete'));
  },
});

export const {
  clearPostsListError,
  clearPostCreateError,
  clearPostUpdateError,
  clearPostDeleteError,
  resetPostsState,
} = postsSlice.actions;

export default postsSlice.reducer;
