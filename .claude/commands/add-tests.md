Add tests using Jest and React Test Renderer.

## Run Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:ci       # CI mode
```

## Test File Locations

Tests are colocated with their source files:

```
src/
├── shared/
│   ├── renderer/
│   │   ├── redux/
│   │   │   ├── configureStore.js
│   │   │   ├── configureStore.test.js    # Store tests
│   │   │   └── features/
│   │   │       └── user/
│   │   │           ├── slice.js
│   │   │           ├── slice.test.js     # Slice tests
│   │   │           ├── selector.js
│   │   │           └── selector.test.js  # Selector tests
│   │   └── components/
│   │       └── Rbac/
│   │           ├── Rbac.js
│   │           ├── Rbac.test.js          # Component tests
│   │           └── utils.test.js         # Utility tests
│   └── api/
│       └── cache/
│           ├── index.js
│           └── cache.test.js             # API tests
└── modules/
    └── blog/
        └── views/
            └── admin/
                └── posts/
                    └── redux/
                        ├── slice.js
                        └── slice.test.js # Module slice tests
```

## Redux Slice Testing

Test reducers and thunk actions using `createAsyncThunk` patterns:

```javascript
// @apps/blog/views/admin/posts/redux/slice.test.js
import reducer, {
  clearPostsListError,
  clearPostCreateError,
  resetPostsState,
} from './slice';
import { fetchPosts, createPost, deletePost } from './thunks';

describe('[admin/posts] slice.js', () => {
  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = reducer(undefined, { type: '@@INIT' });
      expect(state).toEqual({
        data: {
          posts: [],
          pagination: null,
          fetchedPost: null,
          initialized: { list: false, fetch: false },
        },
        operations: expect.objectContaining({
          list: { loading: false, error: null },
          fetch: { loading: false, error: null },
          create: { loading: false, error: null },
          update: { loading: false, error: null },
          delete: { loading: false, error: null },
        }),
      });
    });
  });

  describe('Synchronous Actions', () => {
    let state;

    beforeEach(() => {
      state = {
        data: { posts: [], pagination: null, initialized: { list: true } },
        operations: {
          list: { loading: false, error: 'List error' },
          create: { loading: false, error: 'Create error' },
        },
      };
    });

    it('should clear list error', () => {
      const newState = reducer(state, clearPostsListError());
      expect(newState.operations.list.error).toBeNull();
      expect(newState.operations.create.error).toBe('Create error');
    });

    it('should clear create error', () => {
      const newState = reducer(state, clearPostCreateError());
      expect(newState.operations.create.error).toBeNull();
    });

    it('should reset to initial state', () => {
      const newState = reducer(state, resetPostsState());
      expect(newState.data.posts).toEqual([]);
      expect(newState.operations.list.error).toBeNull();
    });
  });

  describe('Fetch Posts Thunk', () => {
    it('should set loading on pending', () => {
      const state = reducer(undefined, fetchPosts.pending('requestId', {}));
      expect(state.operations.list.loading).toBe(true);
      expect(state.operations.list.error).toBeNull();
    });

    it('should set posts data on fulfilled', () => {
      const posts = [{ id: 1, title: 'Test Post' }];
      const pagination = { page: 1, limit: 10, total: 1 };
      const state = reducer(
        undefined,
        fetchPosts.fulfilled({ posts, pagination }, 'requestId', {}),
      );
      expect(state.data.posts).toEqual(posts);
      expect(state.data.pagination).toEqual(pagination);
      expect(state.data.initialized.list).toBe(true);
      expect(state.operations.list.loading).toBe(false);
    });

    it('should set error on rejected', () => {
      const state = reducer(
        undefined,
        fetchPosts.rejected(
          new Error('Fetch failed'),
          'requestId',
          {},
          'Fetch failed',
        ),
      );
      expect(state.operations.list.loading).toBe(false);
      expect(state.operations.list.error).toBe('Fetch failed');
    });
  });

  describe('Create Post Thunk', () => {
    it('should set loading on pending', () => {
      const state = reducer(undefined, createPost.pending('requestId', {}));
      expect(state.operations.create.loading).toBe(true);
    });

    it('should add post to list on fulfilled', () => {
      const initialState = {
        data: { posts: [{ id: 1, title: 'Existing' }], initialized: {} },
        operations: { create: { loading: true, error: null } },
      };
      const newPost = { id: 2, title: 'New Post' };
      const state = reducer(
        initialState,
        createPost.fulfilled(newPost, 'requestId', {}),
      );
      expect(state.data.posts[0]).toEqual(newPost); // Prepended
      expect(state.data.posts).toHaveLength(2);
    });
  });

  describe('Delete Post Thunk', () => {
    it('should remove post from list on fulfilled', () => {
      const initialState = {
        data: {
          posts: [
            { id: 1, title: 'Post 1' },
            { id: 2, title: 'Post 2' },
          ],
        },
        operations: { delete: { loading: false, error: null } },
      };
      const state = reducer(
        initialState,
        deletePost.fulfilled({ id: 1 }, 'requestId', 1),
      );
      expect(state.data.posts).toHaveLength(1);
      expect(state.data.posts[0].id).toBe(2);
    });
  });
});
```

## Redux Thunk Testing

Test thunks with mocked `fetch` via store helpers:

```javascript
// @apps/blog/views/admin/posts/redux/thunks.test.js
import configureStore from '@/shared/renderer/redux/configureStore';
import { fetchPosts, createPost } from './thunks';
import reducer, { SLICE_NAME } from './slice';
import { getPosts, isPostsListLoading, getPostsListError } from './selector';

describe('[admin/posts] thunks.js', () => {
  let store;
  let mockFetch;

  beforeEach(() => {
    mockFetch = jest.fn();
    store = configureStore({}, { fetch: mockFetch });
    store.injectReducer(SLICE_NAME, reducer);
  });

  describe('fetchPosts', () => {
    it('should fetch posts successfully', async () => {
      const mockPosts = [{ id: 1, title: 'Test Post' }];
      mockFetch.mockResolvedValueOnce({
        data: { posts: mockPosts, pagination: { total: 1 } },
      });

      await store.dispatch(fetchPosts({ page: 1, limit: 10 }));

      expect(mockFetch).toHaveBeenCalledWith('/api/posts', {
        query: { page: 1, limit: 10 },
      });
      expect(getPosts(store.getState())).toEqual(mockPosts);
      expect(isPostsListLoading(store.getState())).toBe(false);
    });

    it('should handle fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await store.dispatch(fetchPosts());

      expect(getPostsListError(store.getState())).toBe('Network error');
      expect(isPostsListLoading(store.getState())).toBe(false);
    });
  });

  describe('createPost', () => {
    it('should create post successfully', async () => {
      const newPost = { id: 2, title: 'New Post' };
      mockFetch
        .mockResolvedValueOnce({ data: { post: newPost } }) // create
        .mockResolvedValueOnce({ data: { posts: [] } }); // refresh list

      await store.dispatch(
        createPost({ title: 'New Post', content: 'Content' }),
      );

      expect(mockFetch).toHaveBeenCalledWith('/api/posts', {
        method: 'POST',
        body: { title: 'New Post', content: 'Content' },
      });
    });
  });
});
```

## Component Testing with App Context

Components that use Redux, i18n, or History need the full `App` context:

```javascript
// src/shared/renderer/components/MyComponent/MyComponent.test.js
import renderer, { act } from 'react-test-renderer';
import configureStore from 'redux-mock-store';
import i18n, { DEFAULT_LOCALE, AVAILABLE_LOCALES } from '@/shared/i18n';
import App from '@/shared/renderer/App';
import MyComponent from './index';

const mockStore = configureStore();
const fetch = jest.fn();

const initialState = {
  runtime: {
    initialNow: Date.now(),
    appName: 'React Starter Kit',
    appDescription: 'Boilerplate for React.js web applications',
  },
  intl: {
    locale: DEFAULT_LOCALE,
    localeLoading: null,
    localeFallback: null,
    availableLocales: AVAILABLE_LOCALES,
  },
  user: { data: null, operations: {} },
  ui: {
    sidebarOpen: false,
    isAdminPanel: false,
    showPageHeader: false,
  },
};

const mockHistory = {
  location: { pathname: '/', search: '', hash: '', state: null, key: 'test' },
  push: jest.fn(),
  replace: jest.fn(),
  go: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  listen: jest.fn(() => jest.fn()),
};

describe('MyComponent', () => {
  it('renders correctly', () => {
    const store = mockStore(initialState);
    let component;

    act(() => {
      component = renderer.create(
        <App
          context={{
            store,
            fetch,
            i18n,
            locale: store.getState().intl.locale,
            history: mockHistory,
            pathname: '/',
            query: {},
          }}
        >
          <MyComponent />
        </App>,
      );
    });

    const tree = component.toJSON();
    expect(tree).toBeTruthy();

    act(() => {
      component.unmount();
    });
  });
});
```

## Simple Component Testing

For components without context dependencies:

```javascript
import renderer from 'react-test-renderer';
import Button from './Button';

describe('Button', () => {
  it('renders with text', () => {
    const tree = renderer.create(<Button>Click me</Button>).toJSON();
    expect(tree.children).toContain('Click me');
  });

  it('handles click', () => {
    const onClick = jest.fn();
    const component = renderer.create(<Button onClick={onClick}>Click</Button>);

    component.root.findByType('button').props.onClick();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

## Selector Testing

Test selectors with mocked state:

```javascript
// @apps/blog/views/admin/posts/redux/selector.test.js
import {
  getPosts,
  getPostsPagination,
  isPostsListLoading,
  getPostsListError,
  isPostsListInitialized,
} from './selector';
import { SLICE_NAME } from './slice';

describe('[admin/posts] selector.js', () => {
  const createState = sliceState => ({
    [SLICE_NAME]: sliceState,
  });

  describe('getPosts', () => {
    it('should return posts array', () => {
      const posts = [{ id: 1 }, { id: 2 }];
      const state = createState({
        data: { posts },
        operations: {},
      });
      expect(getPosts(state)).toEqual(posts);
    });

    it('should return empty array for null state', () => {
      const state = createState(null);
      expect(getPosts(state)).toEqual([]);
    });
  });

  describe('isPostsListLoading', () => {
    it('should return loading state', () => {
      const state = createState({
        data: {},
        operations: { list: { loading: true, error: null } },
      });
      expect(isPostsListLoading(state)).toBe(true);
    });
  });

  describe('isPostsListInitialized', () => {
    it('should return initialized state', () => {
      const state = createState({
        data: { initialized: { list: true } },
        operations: {},
      });
      expect(isPostsListInitialized(state)).toBe(true);
    });
  });
});
```

## API/Service Testing

Test API utilities and services:

```javascript
// src/shared/api/cache/cache.test.js
import createCache from './index';

describe('[api] cache', () => {
  let cache;

  beforeEach(() => {
    cache = createCache();
  });

  it('should set and get values', () => {
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });

  it('should return null for missing keys', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('should delete values', () => {
    cache.set('key', 'value');
    cache.delete('key');
    expect(cache.get('key')).toBeNull();
  });

  it('should clear all values', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });
});
```

## Mocking

### 1. Mocking Shared Feature Selectors

Mock global selectors (like User or UI) from `shared/renderer`:

```javascript
// Mock user selector
jest.mock('@/shared/renderer/redux/features/user/selector', () => ({
  ...jest.requireActual('@/shared/renderer/redux/features/user/selector'),
  isAuthenticated: jest.fn(() => true),
  getUserProfile: jest.fn(() => ({ id: 1, name: 'Test User' })),
}));
```

### 2. Mocking Module Feature Selectors

Mock selectors from a specific module:

```javascript
// Mock posts selector
jest.mock('@/apps/blog/views/admin/posts/redux/selector', () => ({
  ...jest.requireActual('@/apps/blog/views/admin/posts/redux/selector'),
  getPosts: jest.fn(() => [{ id: 1, title: 'Mocked Post' }]),
  isPostsListLoading: jest.fn(() => false),
}));
```

### 3. Mocking Dependencies

```javascript
// Mock fetch helper
const mockFetch = jest.fn(() => Promise.resolve({ data: [] }));

// Mock store with injectReducer
const store = configureStore({}, { fetch: mockFetch });
store.injectReducer(SLICE_NAME, reducer);
```

## Best Practices

1. **Colocate tests** - Place `.test.js` files next to source files
2. **Use `act()` for state updates** - Wrap async operations and renders
3. **Unmount components** - Prevent memory leaks and async errors
4. **Test thunk actions directly** - Use `thunk.pending()`, `thunk.fulfilled()`, `thunk.rejected()`
5. **Inject reducers** - Use `store.injectReducer(SLICE_NAME, reducer)` for module tests
6. **Use `mockStore` for components** - Use `redux-mock-store` for component tests
7. **Use real `configureStore` for thunks** - Test full integration with selectors
8. **Mock `fetch` via helpers** - Pass `{ fetch: mockFetch }` to `configureStore`
9. **Test behavior, not implementation** - Focus on observable outcomes
10. **Use `describe` blocks** - Group tests by feature (Initial State, Actions, Thunks)
