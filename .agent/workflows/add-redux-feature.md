---
description: Add redux feature
---

Add a new Redux feature for a module view.

## Structure

Redux features are colocated with their view modules, not in the shared renderer:

```
@apps/{module-name}/views/{view-path}/
├── redux/
│   ├── index.js          # Public exports
│   ├── slice.js          # Redux Toolkit slice with extraReducers
│   ├── thunks.js         # Async thunks using createAsyncThunk
│   └── selector.js       # Selectors
├── {ViewName}.js         # View component
├── {ViewName}.css        # CSS Modules styles
└── _route.js             # Route definition
```

## 1. Create Slice

```javascript
// @apps/blog/views/(admin)/posts/redux/slice.js
import { createSlice } from '@reduxjs/toolkit';
import {
  fetchPosts,
  fetchPostById,
  createPost,
  updatePost,
  deletePost,
} from './thunks';

/**
 * Admin Posts Slice
 *
 * Manages admin posts list, CRUD operations with per-operation loading/error tracking.
 */

const createOperationState = () => ({ loading: false, error: null });

/**
 * Create a fresh operations object with all operation states.
 */
const createFreshOperations = () => ({
  list: createOperationState(),
  fetch: createOperationState(),
  create: createOperationState(),
  update: createOperationState(),
  delete: createOperationState(),
});

/**
 * Create fresh data object
 */
const createFreshData = () => ({
  posts: [],
  pagination: null,
  fetchedPost: null, // Single post fetched by ID
  initialized: {
    list: false, // Tracks if list has been fetched at least once
    fetch: false, // Tracks if single item has been fetched
  },
});

// Initial state with fresh operations
const initialState = {
  data: createFreshData(),
  operations: createFreshOperations(),
};

/**
 * Normalize state to ensure it has the expected shape.
 * Handles SSR hydration and state migration.
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

  // Legacy state format
  if ('posts' in state) {
    return {
      data: {
        posts: state.posts || [],
        pagination: state.pagination || null,
      },
      operations: createFreshOperations(),
    };
  }

  return {
    data: createFreshData(),
    operations: createFreshOperations(),
  };
};

/**
 * Create pending handler for a specific operation
 */
const createPendingHandler = operationKey => state => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = { loading: true, error: null };
  Object.assign(state, normalized);
};

/**
 * Create rejected handler for a specific operation
 */
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
 * Slice name constant - used for reducer injection and selectors
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
    clearPostFetchError: state => {
      const normalized = normalizeState(state);
      normalized.operations.fetch.error = null;
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

    // FETCH POST BY ID
    builder
      .addCase(fetchPostById.pending, state => {
        const normalized = normalizeState(state);
        normalized.data.fetchedPost = null;
        normalized.data.initialized.fetch = false;
        normalized.operations.fetch = { loading: true, error: null };
        Object.assign(state, normalized);
      })
      .addCase(fetchPostById.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedPost = action.payload;
        normalized.data.initialized.fetch = true;
        normalized.operations.fetch = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchPostById.rejected, createRejectedHandler('fetch'));

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
          p => p.id !== action.payload.id,
        );
        normalized.operations.delete = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(deletePost.rejected, createRejectedHandler('delete'));
  },
});

export const {
  clearPostsListError,
  clearPostFetchError,
  clearPostCreateError,
  clearPostUpdateError,
  clearPostDeleteError,
  resetPostsState,
} = postsSlice.actions;

export default postsSlice.reducer;
```

## 2. Create Thunks

```javascript
// @apps/blog/views/(admin)/posts/redux/thunks.js
import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Fetch all posts with pagination and filters
 */
export const fetchPosts = createAsyncThunk(
  'admin/posts/fetchPosts',
  async (options = {}, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { page = 1, limit = 10, search = '', status = '' } = options || {};

      const { data } = await fetch('/api/posts', {
        query: {
          page,
          limit,
          search: search || undefined,
          status: status || undefined,
        },
      });

      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Fetch post by ID
 */
export const fetchPostById = createAsyncThunk(
  'admin/posts/fetchPostById',
  async (postId, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/posts/${postId}`);
      return data.post;
    } catch (error) {
      return rejectWithValue(error.message);
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
      const { data } = await fetch('/api/posts', {
        method: 'POST',
        body: postData,
      });

      // Refresh the list to show the new post
      dispatch(fetchPosts());

      return data.post;
    } catch (error) {
      return rejectWithValue(error.message);
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
      const { data } = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        body: postData,
      });

      // Refresh the list to show updated data
      dispatch(fetchPosts());

      return data.post;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Delete a post
 */
export const deletePost = createAsyncThunk(
  'admin/posts/deletePost',
  async (postId, { extra: { fetch }, rejectWithValue }) => {
    try {
      await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      return { id: postId };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);
```

## 3. Create Selectors

```javascript
// @apps/blog/views/(admin)/posts/redux/selector.js
import { normalizeState, SLICE_NAME } from './slice';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getSliceState = state => state[SLICE_NAME];

const getOperationState = (state, operationKey) => {
  const sliceState = getSliceState(state);
  const normalized = normalizeState(sliceState);
  if (!normalized.operations) return null;
  return normalized.operations[operationKey] || null;
};

// =============================================================================
// DATA SELECTORS
// =============================================================================

export const getPosts = state => {
  const sliceState = getSliceState(state);
  const normalized = normalizeState(sliceState);
  return normalized.data?.posts || [];
};

export const getPostsPagination = state => {
  const sliceState = getSliceState(state);
  const normalized = normalizeState(sliceState);
  return normalized.data?.pagination || null;
};

export const getFetchedPost = state => {
  const sliceState = getSliceState(state);
  const normalized = normalizeState(sliceState);
  return normalized.data?.fetchedPost || null;
};

export const isPostsListInitialized = state => {
  const sliceState = getSliceState(state);
  const normalized = normalizeState(sliceState);
  return normalized.data?.initialized?.list || false;
};

export const isPostFetchInitialized = state => {
  const sliceState = getSliceState(state);
  const normalized = normalizeState(sliceState);
  return normalized.data?.initialized?.fetch || false;
};

// =============================================================================
// LIST OPERATION
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
// FETCH OPERATION
// =============================================================================

export const isPostFetchLoading = state => {
  const op = getOperationState(state, 'fetch');
  return !!(op && op.loading);
};

export const getPostFetchError = state => {
  const op = getOperationState(state, 'fetch');
  return (op && op.error) || null;
};

// =============================================================================
// CREATE OPERATION
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
// UPDATE OPERATION
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
// DELETE OPERATION
// =============================================================================

export const isPostDeleteLoading = state => {
  const op = getOperationState(state, 'delete');
  return !!(op && op.loading);
};

export const getPostDeleteError = state => {
  const op = getOperationState(state, 'delete');
  return (op && op.error) || null;
};
```

## 4. Create Index (Public API)

```javascript
// @apps/blog/views/(admin)/posts/redux/index.js

// Public API - Async Thunks
export * from './thunks';

// Public API - Selectors
export * from './selector';

// Public API - Actions (from slice)
export {
  // Per-operation error clear actions
  clearPostsListError,
  clearPostFetchError,
  clearPostCreateError,
  clearPostUpdateError,
  clearPostDeleteError,
  // Utility actions
  resetPostsState,
  // Slice name constant
  SLICE_NAME,
} from './slice';

// Public API - Reducer
export { default } from './slice';
```

## 5. Register Reducer in Route

Use route lifecycle hooks in the view's `_route.js`:

```javascript
// @apps/blog/views/(admin)/posts/_route.js
import reducer, { SLICE_NAME } from './redux';
import PostsList from './PostsList';
import { addBreadcrumb } from '@shared/renderer/redux';
import { requirePermission } from '@shared/renderer/components/Rbac';
import { registerMenu, unregisterMenu } from '@shared/renderer/redux';

/**
 * Middleware - permission check
 */
export const middleware = requirePermission('posts:read');

/**
 * Register - called once when route is discovered (for menus, etc.)
 */
export function register({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      item: {
        path: '/admin/posts',
        label: i18n.t('navigation.posts', 'Posts'),
        icon: 'file-text',
        permission: 'posts:read',
        order: 20,
      },
    }),
  );
}

/**
 * Unregister - called when route is unloaded
 */
export function unregister({ store }) {
  store.dispatch(
    unregisterMenu({
      ns: 'admin',
      path: '/admin/posts',
    }),
  );
}

/**
 * Boot - inject Redux slice (called once per route lifecycle)
 */
export function boot({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Mount - dispatch breadcrumb when route is mounted
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      { label: i18n.t('navigation.posts', 'Posts'), url: path },
      'admin',
    ),
  );
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin.posts.title', 'Posts Management'),
  };
}

/**
 * Default export - Page component
 */
export default PostsList;
```

## 6. Usage in Component

```javascript
// @apps/blog/views/admin/posts/PostsList.js
import { useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchPosts,
  createPost,
  deletePost,
  getPosts,
  getPostsPagination,
  isPostsListLoading,
  isPostsListInitialized,
  isPostCreateLoading,
  isPostDeleteLoading,
  getPostsListError,
  clearPostsListError,
} from './redux';

function PostsList() {
  const dispatch = useDispatch();
  const posts = useSelector(getPosts);
  const pagination = useSelector(getPostsPagination);
  const loading = useSelector(isPostsListLoading);
  const initialized = useSelector(isPostsListInitialized);
  const creating = useSelector(isPostCreateLoading);
  const deleting = useSelector(isPostDeleteLoading);
  const error = useSelector(getPostsListError);

  // Fetch on mount (only if not already initialized)
  useEffect(() => {
    if (!initialized) {
      dispatch(fetchPosts());
    }
  }, [dispatch, initialized]);

  // Clear error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearPostsListError());
    };
  }, [dispatch]);

  const handleCreate = useCallback(
    async data => {
      try {
        await dispatch(createPost(data)).unwrap();
        // Success - post added to list automatically
      } catch (error) {
        // Error handled by Redux state
      }
    },
    [dispatch],
  );

  const handleDelete = useCallback(
    async id => {
      try {
        await dispatch(deletePost(id)).unwrap();
      } catch (error) {
        // Error handled by Redux state
      }
    },
    [dispatch],
  );

  const handlePageChange = useCallback(
    page => {
      dispatch(fetchPosts({ page }));
    },
    [dispatch],
  );

  if (!initialized && loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <button
        onClick={() => handleCreate({ title: 'New Post' })}
        disabled={creating}
      >
        {creating ? 'Creating...' : 'Create Post'}
      </button>

      {posts.map(post => (
        <div key={post.id}>
          <span>{post.title}</span>
          <button onClick={() => handleDelete(post.id)} disabled={deleting}>
            Delete
          </button>
        </div>
      ))}

      {pagination && (
        <div>
          Page {pagination.page} of{' '}
          {Math.ceil(pagination.total / pagination.limit)}
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={
              pagination.page >= Math.ceil(pagination.total / pagination.limit)
            }
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default PostsList;
```

## Route Lifecycle Hooks

| Hook              | Purpose                                | Called When          |
| ----------------- | -------------------------------------- | -------------------- |
| `register`        | Register menus, global state           | Route discovered     |
| `unregister`      | Cleanup menus, global state            | Route unloaded       |
| `boot`            | Inject Redux reducer                   | Before route renders |
| `mount`           | Dispatch breadcrumbs, track navigation | Route mounted        |
| `middleware`      | Permission checks, redirects           | Before rendering     |
| `getInitialProps` | Data fetching, page metadata           | Before rendering     |

## Key Patterns

1. **Module-level Redux** - Redux features live in `views/{view-path}/redux/` not shared
2. **SLICE_NAME constant** - Use namespaced slice name like `@admin/posts` for dynamic injection
3. **boot() for reducer injection** - Use `store.injectReducer(SLICE_NAME, reducer)` in `boot` hook
4. **register() for menus** - Register admin menu items when route is discovered
5. **Per-operation loading/error** - Track each operation independently (list, fetch, create, update, delete)
6. **Initialized tracking** - Track if data has been fetched to avoid duplicate requests
7. **Access fetch via `extra`** - Use `{ extra: { fetch }, rejectWithValue }` in thunks
8. **Selectors use SLICE_NAME** - Access state via `state[SLICE_NAME]` for dynamic slices
9. **Clear errors on unmount** - Use `clearXxxError` actions in cleanup effects

## Best Practices

1. **Use `createAsyncThunk`** - Automatic pending/fulfilled/rejected action dispatching
2. **Normalize state** - Handle SSR hydration and state migration with `normalizeState`
3. **Use `.unwrap()`** - Get direct promise result from thunk dispatch for try/catch
4. **Dispatch refresh after mutations** - Call `fetchList()` after create/update to sync data
5. **Guard with `initialized`** - Prevent duplicate fetches on component remounts
6. **Export via index.js** - Centralized public API per redux folder
