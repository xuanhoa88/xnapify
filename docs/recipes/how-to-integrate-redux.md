## How to Integrate [Redux](https://redux.js.org/)

React Starter Kit comes with Redux pre-integrated and configured. This guide shows you how to work with Redux in the application using modern patterns and React Hooks.

**If you're new to Redux, read the [official documentation](https://redux.js.org/introduction/getting-started) first.**

## Current Redux Setup

The application uses:

- **Redux** 4.2.1 - State management
- **React Redux** 7.2.9 - React bindings with Hooks support
- **Redux Thunk** 2.4.2 - Async action middleware
- **Redux DevTools** - Development debugging (browser extension)

### Store Structure

```javascript
{
  runtime: {      // Runtime variables (set via setRuntimeVariable)
    initialNow: Date,      // Timestamp for SSR consistency
    availableLocales: {},  // Available locales for language switcher
    appName: String,       // Application name
    appDescription: String, // Application description
  },
  intl: {         // Internationalization
    locale: 'en-US',
    messages: {},
  },
  user: {         // User authentication
    id: null,
    email: null,
    display_name: null,
  },
  // Add your reducers here
}
```

## Creating Actions

### 1. Define Action Constants

Add your action types to your feature's constants file `src/redux/features/posts/constants.js`:

```javascript
// src/redux/features/posts/constants.js

// Existing constants
export const SET_RUNTIME_VARIABLE = 'SET_RUNTIME_VARIABLE';
export const SET_LOCALE_START = 'SET_LOCALE_START';
export const SET_LOCALE_SUCCESS = 'SET_LOCALE_SUCCESS';
export const SET_LOCALE_ERROR = 'SET_LOCALE_ERROR';

// Your new constants
export const FETCH_POSTS_START = 'FETCH_POSTS_START';
export const FETCH_POSTS_SUCCESS = 'FETCH_POSTS_SUCCESS';
export const FETCH_POSTS_ERROR = 'FETCH_POSTS_ERROR';
```

### 2. Create Action Creators

Create a new file in `src/redux/features/posts/` (e.g., `src/redux/features/posts/actions.js`):

```javascript
// src/redux/features/posts/actions.js

import {
  FETCH_POSTS_START,
  FETCH_POSTS_SUCCESS,
  FETCH_POSTS_ERROR,
} from '../constants';

/**
 * Fetch posts from API
 * @returns {Function} Redux thunk action
 */
export function fetchPosts() {
  return async (dispatch, getState, { fetch, navigator }) => {
    // Dispatch start action
    dispatch({ type: FETCH_POSTS_START });

    try {
      // Make API request using the fetch from context
      const posts = await fetch('/api/posts');

      // Dispatch success action with data
      dispatch({
        type: FETCH_POSTS_SUCCESS,
        payload: { posts },
      });

      // Navigate to posts page after successful fetch (if needed)
      navigator.navigateTo('/posts');

      return posts;
    } catch (error) {
      // Dispatch error action
      dispatch({
        type: FETCH_POSTS_ERROR,
        payload: { error: error.message },
      });

      // Navigate to error page on failure (if needed)
      navigator.navigateTo('/error');

      return null;
    }
  };
}
```

### 3. Async Actions with Redux Thunk

Redux Thunk is already configured. Your async actions receive three arguments:

- `dispatch` - Dispatch actions
- `getState` - Access current state
- `{ fetch, navigator }` - Extra arguments (fetch utility for API calls, navigator for navigation)

**Navigation API:**

The `navigator` parameter in Redux actions provides safe navigation methods that work on both client and server:

```javascript
export function myAction() {
  return async (dispatch, getState, { fetch, navigator }) => {
    // Navigate to a new location
    navigator.navigateTo('/posts');
    navigator.navigateTo('/posts/123');

    // Replace current location
    navigator.replaceTo('/login');

    // Navigate back/forward
    navigator.goBack();
    navigator.goForward();

    // Get current location
    const location = navigator.getCurrentLocation();
    // Returns: { pathname, search, hash, state, key } or null on server
  };
}
```

**Note:** All navigation methods are safe to call on the server (they become no-ops). The `navigator` is a namespace import of all exported functions from `src/navigator.js`.

## Creating Reducers

### 1. Create a Reducer File

Create a new file in `src/redux/features/posts/` (e.g., `src/redux/features/posts/reducer.js`):

```javascript
// src/redux/features/posts/reducer.js

import {
  FETCH_POSTS_START,
  FETCH_POSTS_SUCCESS,
  FETCH_POSTS_ERROR,
} from '../constants';

// Initial state
const initialState = {
  items: [],
  loading: false,
  error: null,
};

/**
 * Posts reducer
 * @param {Object} state - Current state
 * @param {Object} action - Dispatched action
 * @returns {Object} New state
 */
export default function posts(state = initialState, action) {
  switch (action.type) {
    case FETCH_POSTS_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case FETCH_POSTS_SUCCESS:
      return {
        ...state,
        items: action.payload.posts,
        loading: false,
        error: null,
      };

    case FETCH_POSTS_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload.error,
      };

    case 'CLEAR_POSTS':
      return initialState;

    default:
      return state;
  }
}
```

### 2. Create Feature Public API

Create `src/redux/features/posts/index.js` to export the feature's public API:

```javascript
// src/redux/features/posts/index.js

// Public API - Actions
export { fetchPosts, clearPosts } from './actions';

// Public API - Constants (for testing/external use)
export {
  FETCH_POSTS_START,
  FETCH_POSTS_SUCCESS,
  FETCH_POSTS_ERROR,
  CLEAR_POSTS,
} from './constants';

// Public API - Selectors
export { getPosts, getPostById, isLoading, getError } from './reducer';

// Public API - Reducer (default export for rootReducer)
export { default } from './reducer';
export { default as postsReducer } from './reducer';
```

### 3. Add Reducer to Root Reducer

Edit `src/redux/rootReducer.js`:

```javascript
// src/redux/rootReducer.js

import { combineReducers } from 'redux';
import user from './features/user';
import runtime from './features/runtime';
import intl from './features/intl';
import posts from './features/posts'; // Import your feature

export default combineReducers({
  user,
  runtime,
  intl,
  posts, // Add to combined reducers
});
```

### 4. Export from Main Redux Module

Edit `src/redux/index.js` to export your feature:

```javascript
// src/redux/index.js

// ... existing exports

// Feature: Posts
export {
  fetchPosts,
  clearPosts,
  FETCH_POSTS_START,
  FETCH_POSTS_SUCCESS,
  FETCH_POSTS_ERROR,
  CLEAR_POSTS,
} from './features/posts';
```

### Reducer Best Practices

✅ **DO:**

- Always return state (even if unchanged)
- Use spread operator for immutable updates: `{ ...state, key: value }`
- Keep reducers pure (no side effects)
- Handle all action types with default case

❌ **DON'T:**

- Mutate state directly: `state.key = value` ❌
- Call APIs in reducers (do it in actions)
- Generate random values in reducers (pass via action payload)
- Access `Date.now()` in reducers (pass timestamp via action)

**Example: Immutable Updates**

```javascript
// ❌ WRONG - Mutates state
case 'ADD_POST':
  state.items.push(action.payload.post);
  return state;

// ✅ CORRECT - Returns new state
case 'ADD_POST':
  return {
    ...state,
    items: [...state.items, action.payload.post],
  };

// ✅ CORRECT - Update nested object
case 'UPDATE_POST':
  return {
    ...state,
    items: state.items.map(post =>
      post.id === action.payload.id
        ? { ...post, ...action.payload.updates }
        : post
    ),
  };
```

## Using Redux in Components

### Modern Approach: React Hooks (Recommended)

Use `useSelector` and `useDispatch` hooks from `react-redux`:

```javascript
import React, { useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchPosts, clearPosts } from '../../actions/posts';

function PostsList() {
  const dispatch = useDispatch();

  // Select data from store
  const posts = useSelector(state => state.posts.items);
  const loading = useSelector(state => state.posts.loading);
  const error = useSelector(state => state.posts.error);

  // Fetch posts on mount
  useEffect(() => {
    dispatch(fetchPosts());

    // Cleanup on unmount
    return () => {
      dispatch(clearPosts());
    };
  }, [dispatch]);

  // Memoized callback
  const handleRefresh = useCallback(() => {
    dispatch(fetchPosts());
  }, [dispatch]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <button onClick={handleRefresh}>Refresh</button>
      <ul>
        {posts.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  );
}

export default PostsList;
```

### Legacy Approach: connect() HOC

For class components or when you need more control:

```javascript
import React from 'react';
import { connect } from 'react-redux';
import { fetchPosts } from '../../actions/posts';

class PostsList extends React.Component {
  componentDidMount() {
    this.props.fetchPosts();
  }

  render() {
    const { posts, loading } = this.props;

    if (loading) return <div>Loading...</div>;

    return (
      <ul>
        {posts.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    );
  }
}

// Map state to props
const mapStateToProps = state => ({
  posts: state.posts.items,
  loading: state.posts.loading,
});

// Map dispatch to props
const mapDispatchToProps = {
  fetchPosts,
};

export default connect(mapStateToProps, mapDispatchToProps)(PostsList);
```

## Server-Side Redux

### How It Works

1. **Store Creation** - A new Redux store is created for each request
2. **Initial State** - Store is populated with server-side data
3. **Rendering** - React components render with Redux state
4. **State Serialization** - State is serialized and sent to client
5. **Hydration** - Client rehydrates with server state

### Server-Side Store Configuration

See `src/server.js` for the complete implementation:

```javascript
import { configureStore, setRuntimeVariable, setLocale } from './redux';
import { AVAILABLE_LOCALES } from './i18n';
import { createFetch } from './createFetch';
import * as navigator from './navigator';
import nodeFetch from 'node-fetch';

/**
 * Create Redux store for SSR with user, runtime vars, and locale
 */
async function createReduxStore(req, fetch, i18n, availableLocales) {
  // Create store with initial user state (from JWT token)
  const store = configureStore(
    { user: req.user || null },
    { fetch, navigator, i18n },
  );

  // Define all runtime variables
  const runtimeVariables = {
    initialNow: Date.now(),
    availableLocales,
    appName: process.env.RSK_APP_NAME || 'React Starter Kit',
    appDescription:
      process.env.RSK_APP_DESCRIPTION ||
      'Boilerplate for React.js web applications',
  };

  // Dispatch all runtime variables at once
  store.dispatch(setRuntimeVariable(runtimeVariables));

  // Set locale from request
  const locale = req.language || 'en-US';
  await store.dispatch(setLocale(locale));

  return store;
}

// In request handler:
const fetch = createFetch(nodeFetch, {
  baseUrl: `http://localhost:${process.env.RSK_PORT || 3000}`,
  cookie: req.headers.cookie,
});

const store = await createReduxStore(req, fetch, i18n, AVAILABLE_LOCALES);

// Render with store
const app = (
  <Provider store={store}>
    <App context={context}>{route.component}</App>
  </Provider>
);

const html = ReactDOM.renderToString(app);

// Serialize state for client
const data = {
  // ...
  state: store.getState(), // Send state to client
};
```

### Dispatching Actions on Server

**Example: Fetch data before rendering**

```javascript
// src/routes/posts/index.js

export default {
  path: '/posts',

  async action({ store, fetch }) {
    // Dispatch action on server
    await store.dispatch(fetchPosts());

    return {
      title: 'Posts',
      component: <PostsPage />,
    };
  },
};
```

## Testing Redux Code

### Testing Actions

```javascript
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import {
  fetchPosts,
  FETCH_POSTS_START,
  FETCH_POSTS_SUCCESS,
} from '../../redux/features/posts';

const middlewares = [thunk.withExtraArgument({ fetch: mockFetch })];
const mockStore = configureMockStore(middlewares);
const mockFetch = jest.fn();

describe('posts actions', () => {
  it('dispatches FETCH_POSTS_SUCCESS on successful fetch', async () => {
    const posts = [{ id: 1, title: 'Test Post' }];

    mockFetch.mockResolvedValue({
      json: async () => posts,
    });

    const store = mockStore({ posts: { items: [] } });
    await store.dispatch(fetchPosts());

    const actions = store.getActions();
    expect(actions[0].type).toBe(FETCH_POSTS_START);
    expect(actions[1].type).toBe(FETCH_POSTS_SUCCESS);
    expect(actions[1].payload.posts).toEqual(posts);
  });
});
```

### Testing Reducers

```javascript
import posts, { FETCH_POSTS_SUCCESS } from '../../redux/features/posts/reducer';

describe('posts reducer', () => {
  it('handles FETCH_POSTS_SUCCESS', () => {
    const testPosts = [{ id: 1, title: 'Test' }];

    const state = posts(undefined, {
      type: FETCH_POSTS_SUCCESS,
      payload: { posts: testPosts },
    });

    expect(state.items).toEqual(testPosts);
    expect(state.loading).toBe(false);
  });
});
```

**See also:** [Testing Your Application](../testing-your-application.md) for more examples.

## Best Practices

### 1. Use Hooks for New Components

✅ **DO:** Use `useSelector` and `useDispatch` hooks
❌ **DON'T:** Use `connect()` for new functional components

### 2. Memoize Callbacks

```javascript
const handleClick = useCallback(
  id => {
    dispatch(deletePost(id));
  },
  [dispatch],
);
```

### 3. Keep State Normalized

```javascript
// ✅ Good - Normalized
{
  posts: {
    byId: { '1': { id: 1, title: 'Post 1' } },
    allIds: [1],
  }
}

// ❌ Bad - Nested
{
  posts: [
    { id: 1, title: 'Post 1', author: { id: 10, name: 'Author' } }
  ]
}
```

### 4. Create Reusable Selectors

```javascript
// src/redux/features/posts/reducer.js
export const getPosts = state => state.posts.items;
export const getPostById = (state, id) =>
  state.posts.items.find(p => p.id === id);

// Usage
const posts = useSelector(getPosts);
```

## Additional Resources

- **Redux Documentation**: https://redux.js.org/
- **React Redux Hooks**: https://react-redux.js.org/api/hooks
- **Redux Thunk**: https://github.com/reduxjs/redux-thunk
- **Redux DevTools**: https://github.com/reduxjs/redux-devtools
- **Redux Style Guide**: https://redux.js.org/style-guide/style-guide
