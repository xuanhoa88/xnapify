Add a new Redux feature using Redux Toolkit.

## Structure

```
src/shared/renderer/redux/features/{feature-name}/
├── index.js          # Public exports
├── slice.js          # Redux Toolkit slice
├── thunks.js         # Async thunks
├── selector.js       # Selectors
├── utils.js          # Helper functions (optional)
├── slice.test.js     # Slice tests
└── thunks.test.js    # Thunk tests
```

## 1. Create Slice

```javascript
// src/shared/renderer/redux/features/posts/slice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [],
  loading: false,
  error: null,
  selectedId: null,
};

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setPosts: (state, action) => {
      state.items = action.payload;
      state.loading = false;
      state.error = null;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    selectPost: (state, action) => {
      state.selectedId = action.payload;
    },
    clearSelection: state => {
      state.selectedId = null;
    },
  },
});

export const { setLoading, setPosts, setError, selectPost, clearSelection } =
  postsSlice.actions;
export default postsSlice.reducer;
```

## 2. Create Thunks

```javascript
// src/shared/renderer/redux/features/posts/thunks.js
import { setLoading, setPosts, setError } from './slice';

export const fetchPosts =
  () =>
  async (dispatch, getState, { fetch }) => {
    try {
      dispatch(setLoading(true));
      const response = await fetch('/api/posts');
      dispatch(setPosts(response.data));
    } catch (error) {
      dispatch(setError(error.message));
    }
  };

export const createPost =
  data =>
  async (dispatch, getState, { fetch }) => {
    try {
      dispatch(setLoading(true));
      const response = await fetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      // Refresh posts list
      dispatch(fetchPosts());
      return response.data;
    } catch (error) {
      dispatch(setError(error.message));
      throw error;
    }
  };

export const deletePost =
  id =>
  async (dispatch, getState, { fetch }) => {
    try {
      await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      dispatch(fetchPosts());
    } catch (error) {
      dispatch(setError(error.message));
    }
  };
```

## 3. Create Selectors

```javascript
// src/shared/renderer/redux/features/posts/selector.js
import { createSelector } from '@reduxjs/toolkit';

// Basic selectors
export const getPosts = state => state.posts.items;
export const getPostsLoading = state => state.posts.loading;
export const getPostsError = state => state.posts.error;
export const getSelectedPostId = state => state.posts.selectedId;

// Memoized selectors
export const getSelectedPost = createSelector(
  [getPosts, getSelectedPostId],
  (posts, selectedId) => posts.find(post => post.id === selectedId),
);

export const getPublishedPosts = createSelector([getPosts], posts =>
  posts.filter(post => post.published),
);

export const getPostsByAuthor = createSelector(
  [getPosts, (state, authorId) => authorId],
  (posts, authorId) => posts.filter(post => post.authorId === authorId),
);
```

## 4. Create Index (Public API)

```javascript
// src/shared/renderer/redux/features/posts/index.js
export { default as postsReducer } from './slice';
export * from './slice';
export * from './thunks';
export * from './selector';
```

## 5. Add to Root Reducer

```javascript
// src/shared/renderer/redux/rootReducer.js
import { postsReducer } from './features/posts';

export default {
  // ... existing reducers
  posts: postsReducer,
};
```

## 6. Testing Slice

```javascript
// src/shared/renderer/redux/features/posts/slice.test.js
import reducer, { setPosts, selectPost, clearSelection } from './slice';

describe('[redux] posts slice', () => {
  const initialState = {
    items: [],
    loading: false,
    error: null,
    selectedId: null,
  };

  it('should handle setPosts', () => {
    const posts = [{ id: 1, title: 'Test' }];
    const state = reducer(initialState, setPosts(posts));

    expect(state.items).toEqual(posts);
    expect(state.loading).toBe(false);
    expect(state.error).toBe(null);
  });

  it('should handle selectPost', () => {
    const state = reducer(initialState, selectPost(1));
    expect(state.selectedId).toBe(1);
  });

  it('should handle clearSelection', () => {
    const state = reducer({ ...initialState, selectedId: 1 }, clearSelection());
    expect(state.selectedId).toBe(null);
  });
});
```

## 7. Testing Thunks

```javascript
// src/shared/renderer/redux/features/posts/thunks.test.js
import configureStore from '@/shared/renderer/redux/configureStore';
import { fetchPosts } from './thunks';
import { getPosts, getPostsLoading } from './selector';

describe('[redux] posts thunks', () => {
  it('should fetch posts successfully', async () => {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        data: [{ id: 1, title: 'Test Post' }],
      }),
    );

    const store = configureStore({}, { fetch: mockFetch });

    await store.dispatch(fetchPosts());

    expect(mockFetch).toHaveBeenCalledWith('/api/posts');
    expect(getPosts(store.getState())).toHaveLength(1);
    expect(getPostsLoading(store.getState())).toBe(false);
  });

  it('should handle fetch error', async () => {
    const mockFetch = jest.fn(() => Promise.reject(new Error('Network error')));

    const store = configureStore({}, { fetch: mockFetch });

    await store.dispatch(fetchPosts());

    expect(store.getState().posts.error).toBe('Network error');
    expect(store.getState().posts.loading).toBe(false);
  });
});
```

## Usage in Components

```javascript
import { useSelector, useDispatch } from 'react-redux';
import { fetchPosts, createPost } from '@/shared/renderer/redux/features/posts';
import {
  getPosts,
  getPostsLoading,
} from '@/shared/renderer/redux/features/posts/selector';

function PostsList() {
  const dispatch = useDispatch();
  const posts = useSelector(getPosts);
  const loading = useSelector(getPostsLoading);

  useEffect(() => {
    dispatch(fetchPosts());
  }, [dispatch]);

  const handleCreate = async data => {
    await dispatch(createPost(data));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

## Best Practices

1. **Use Redux Toolkit** - Simplifies reducer logic with Immer
2. **Memoize selectors** - Use `createSelector` for derived data
3. **Keep slices focused** - One feature per slice
4. **Use thunks for async** - Keep components clean
5. **Test reducers and thunks** - Ensure state updates correctly
6. **Normalize state** - For complex data structures
7. **Export public API** - Use index.js for clean imports
