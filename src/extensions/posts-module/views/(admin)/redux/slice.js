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
  state.operations[operationKey].loading = true;
  state.operations[operationKey].error = null;
};

const createRejectedHandler = operationKey => (state, action) => {
  state.operations[operationKey].loading = false;
  state.operations[operationKey].error =
    action.payload ||
    (action.error && action.error.message) ||
    'An error occurred';
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
      state.operations.list.error = null;
    },
    clearPostCreateError: state => {
      state.operations.create.error = null;
    },
    clearPostUpdateError: state => {
      state.operations.update.error = null;
    },
    clearPostDeleteError: state => {
      state.operations.delete.error = null;
    },
    resetPostsState: () => initialState,
  },
  extraReducers: builder => {
    // FETCH POSTS LIST
    builder
      .addCase(fetchPosts.pending, createPendingHandler('list'))
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.data.posts = action.payload.posts || [];
        state.data.pagination = action.payload.pagination || null;
        state.data.initialized.list = true;
        state.operations.list.loading = false;
        state.operations.list.error = null;
      })
      .addCase(fetchPosts.rejected, createRejectedHandler('list'));

    // CREATE POST
    builder
      .addCase(createPost.pending, createPendingHandler('create'))
      .addCase(createPost.fulfilled, (state, action) => {
        state.data.posts.unshift(action.payload);
        state.operations.create.loading = false;
        state.operations.create.error = null;
      })
      .addCase(createPost.rejected, createRejectedHandler('create'));

    // UPDATE POST
    builder
      .addCase(updatePost.pending, createPendingHandler('update'))
      .addCase(updatePost.fulfilled, (state, action) => {
        const index = state.data.posts.findIndex(
          p => p.id === action.payload.id,
        );
        if (index !== -1) {
          Object.assign(state.data.posts[index], action.payload);
        }
        state.operations.update.loading = false;
        state.operations.update.error = null;
      })
      .addCase(updatePost.rejected, createRejectedHandler('update'));

    // DELETE POST
    builder
      .addCase(deletePost.pending, createPendingHandler('delete'))
      .addCase(deletePost.fulfilled, (state, action) => {
        state.data.posts = state.data.posts.filter(
          p => p.id !== action.payload,
        );
        state.operations.delete.loading = false;
        state.operations.delete.error = null;
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
