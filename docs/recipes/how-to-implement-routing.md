## How to Implement Routing and Navigation

Let's see how a custom routing solution under 100 lines of code may look like.

First, you will need to implement the **list of application routes** in which each route can be
represented as an object with properties of `path` (a parametrized URL path string), `action`
(a function), and optionally `children` (a list of sub-routes, each of which is a route object).
The `action` function returns anything - a string, a React component, etc. For example:

#### `src/routes/index.js`

```js
export default [
  {
    path: '/tasks',
    action({ fetch }) {
      const data = await fetch('/api/tasks');
      return data && {
        title: `To-do (${data.length})`,
        component: <TodoList {...data} />
      };
    }
  },
  {
    path: '/tasks/:id',
    action({ params, fetch }) {
      const data = await fetch(`/api/tasks/${params.id}`);
      return data && {
        title: data.title,
        component: <TodoItem {...data} />
      };
    }
  }
];
```

Next, implement a **URL Matcher** function that will be responsible for matching a parametrized
path string to the actual URL. For example, calling `matchURI('/tasks/:id', '/tasks/123')` must
return `{ id: '123' }` while calling `matchURI('/tasks/:id', '/foo')` must return `null`.
Fortunately, there is a great library called [`path-to-regexp`](https://github.com/pillarjs/path-to-regexp)
that makes this task very easy. Here is how a URL matcher function may look like:

#### `src/router.js`

```js
import toRegExp from 'path-to-regexp';

function matchURI(path, uri) {
  const keys = [];
  const pattern = toRegExp(path, keys); // TODO: Use caching
  const match = pattern.exec(uri);
  if (!match) return null;
  const params = Object.create(null);
  for (let i = 1; i < match.length; i++) {
    params[keys[i - 1].name] = match[i] !== undefined ? match[i] : undefined;
  }
  return params;
}
```

Finally, implement a **Route Resolver** function that given a list of routes and a URL/context
should find the first route matching the provided URL string, execute its action method, and if the
action method returns anything other than `null` or `undefined` return that to the caller.
Otherwise, it should continue iterating over the remaining routes. If none of the routes match to the
provided URL string, it should throw an exception (Not found). Here is how this function may look like:

#### `src/router.js`

```js
import toRegExp from 'path-to-regexp';

function matchURI(path, uri) { ... } // See above

async function resolve(routes, context) {
  for (const route of routes) {
    const uri = context.error ? '/error' : context.pathname;
    const params = matchURI(route.path, uri);
    if (!params) continue;
    const result = await route.action({ ...context, params });
    if (result) return result;
  }
  const error = new Error('Not found');
  error.status = 404;
  throw error;
}

export default { resolve };
```

That's it! Here is a usage example:

```js
import router from './router';
import routes from './routes';

router.resolve(routes, { pathname: '/tasks' }).then(result => {
  console.log(result);
  // => { title: 'To-do', component: <TodoList .../> }
});
```

While you can use this as it is on the server, in a browser environment it must be combined with a
client-side navigation solution. React Starter Kit uses the [`history`](https://github.com/ReactTraining/history)
npm module wrapped in a `navigator` module (`src/navigator.js`) that provides server-safe navigation methods.

### Navigator Module

The navigator module wraps the `history` library and provides methods that work safely on both client and server:

### Client-Side Integration

The navigator is used in the client-side bootstrap code to handle routing:

#### `src/client.js` (simplified)

```js
import React from 'react';
import { createRoot } from 'react-dom/client';
import queryString from 'query-string';
import App from './components/App';
import router from './router';
import * as navigator from './navigator';

const container = document.getElementById('app');
let currentLocation = navigator.getCurrentLocation();
let root = null;

async function onLocationChange(location, action) {
  currentLocation = location;

  try {
    // Build context for router
    const context = {
      pathname: location.pathname,
      query: queryString.parse(location.search),
      // ... other context properties
    };

    // Resolve route using Universal Router
    const route = await router.resolve(context);

    // Handle redirects
    if (route.redirect) {
      navigator.replaceTo(route.redirect);
      return;
    }

    // Render the route component
    const appElement = <App context={context}>{route.component}</App>;

    // Use React 18+ createRoot API (falls back to ReactDOM.render for React 16/17)
    if (!root) {
      root = createRoot(container);
    }
    root.render(appElement);

    // Update page title
    if (route.title) {
      document.title = route.title;
    }
  } catch (error) {
    console.error('Navigation error:', error);
  }
}

// Initial render
await onLocationChange(currentLocation);

// Subscribe to navigation changes
navigator.subscribeToNavigation(onLocationChange);
```

Whenever a new location is pushed into the navigation stack, the `onLocationChange()` method is called,
which resolves the route using Universal Router and renders the returned React component into the DOM.

In order to trigger client-side navigation without causing full-page refresh, you need to use
the `navigator.navigateTo()` method from `src/navigator.js`, for example:

```js
import React from 'react';
import * as navigator from '../navigator';

class App extends React.Component {
  transition = event => {
    event.preventDefault();
    // Use navigateTo for simple path navigation
    navigator.navigateTo(
      event.currentTarget.pathname + event.currentTarget.search,
    );
  };
  render() {
    return (
      <ul>
        <li>
          <a href='/' onClick={this.transition}>
            Home
          </a>
        </li>
        <li>
          <a href='/one' onClick={this.transition}>
            One
          </a>
        </li>
        <li>
          <a href='/two' onClick={this.transition}>
            Two
          </a>
        </li>
      </ul>
    );
  }
}
```

Though, it is a common practice to extract that transitioning functionality into a stand-alone
(`Link`) component that can be used as follows:

```html
<Link to="/tasks/123">View Task #123</Link>
```

### Navigator Module (`src/navigator.js`)

React Starter Kit provides a `navigator` module that wraps the `history` library and provides
server-safe navigation methods. All methods check for history existence and become no-ops on the server.

**Available Methods:**

```js
import * as navigator from './navigator';

// Navigate to a new location
navigator.navigateTo('/posts');
navigator.navigateTo('/posts/123');

// Replace current location (no history entry)
navigator.replaceTo('/login');

// Navigate back/forward
navigator.goBack();
navigator.goForward();

// Get current location
const location = navigator.getCurrentLocation();
// Returns: { pathname, search, hash, state, key } or null on server

// Subscribe to navigation changes
const unsubscribe = navigator.listen((location, action) => {
  console.log('Navigation:', location.pathname, action);
});

// Unsubscribe when done
unsubscribe();
```

**Usage in Redux Actions:**

The navigator is automatically available in Redux Thunk actions:

```js
export function createPost(postData) {
  return async (dispatch, getState, { fetch, navigator }) => {
    try {
      const post = await fetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(postData),
      });

      dispatch({ type: 'CREATE_POST_SUCCESS', payload: { post } });

      // Navigate to the new post
      navigator.navigateTo(`/posts/${post.id}`);
    } catch (error) {
      dispatch({ type: 'CREATE_POST_ERROR', payload: { error } });
      navigator.replaceTo('/error');
    }
  };
}
```

### Routing in React Starter Kit

React Starter Kit uses [Universal Router](https://github.com/kriasoft/universal-router), a lightweight
isomorphic router that works on both server and client. It provides a simple, flexible routing solution
with code splitting support.

#### Key Features

- **Isomorphic**: Same routing logic on server and client
- **Code Splitting**: Routes loaded on-demand with webpack dynamic imports
- **Nested Routes**: Hierarchical route structure with parent/child relationships
- **Middleware Pattern**: Express/Koa-style route handlers
- **Lightweight**: Minimal dependencies (just `path-to-regexp`)
- **Framework Agnostic**: Works with any JavaScript framework

#### Route Configuration

Routes are defined in `src/routes/index.js` with code splitting:

```js
const routes = {
  path: '',
  children: [
    {
      path: '',
      load: () => import(/* webpackChunkName: 'home' */ './home'),
    },
    {
      path: '/contact',
      load: () => import(/* webpackChunkName: 'contact' */ './contact'),
    },
    {
      path: '/about',
      load: () => import(/* webpackChunkName: 'about' */ './about'),
    },
    // Wildcard route (must go last)
    {
      path: '(.*)',
      load: () => import(/* webpackChunkName: 'not-found' */ './not-found'),
    },
  ],

  async action({ next }) {
    const route = await next();
    route.title = `${route.title || 'Untitled'} - React Starter Kit`;
    return route;
  },
};
```

#### Route Handler

Each route exports an action function:

```js
// src/routes/home/index.js
import React from 'react';
import Home from './Home';

export default {
  async action() {
    return {
      title: 'Home',
      component: <Home />,
    };
  },
};
```

#### Router Setup

The router is configured in `src/router.js`:

#### Navigation Integration

The router integrates with the navigator module for client-side navigation:

```js
// src/client.js
import router from './router';
import * as navigator from './navigator';

async function onLocationChange(location, action) {
  const context = {
    pathname: location.pathname,
    query: queryString.parse(location.search),
  };

  // Resolve route
  const route = await router.resolve(context);

  // Handle redirects
  if (route.redirect) {
    navigator.replaceTo(route.redirect);
    return;
  }

  // Render component
  root.render(<App context={context}>{route.component}</App>);
}

// Subscribe to navigation changes
navigator.subscribeToNavigation(onLocationChange);
```

#### Link Component

Use the `Link` component for client-side navigation:

```js
import Link from '../../components/Link';

<Link to="/about">About Us</Link>
<Link to="/contact">Contact</Link>
```

The `Link` component automatically uses `navigator.navigateTo()` for client-side navigation.

#### Benefits

- **Code Splitting**: Each route is a separate webpack chunk, loaded on-demand
- **SEO Friendly**: Server-side rendering with full route resolution
- **Fast Navigation**: Client-side navigation without page reloads
- **Type-Safe**: Easy to add TypeScript types
- **Flexible**: Middleware pattern allows custom route logic

For more information, see the [Universal Router documentation](https://github.com/kriasoft/universal-router/blob/master/docs/getting-started.md).

### Related Articles

- [You might not need React Router](https://medium.freecodecamp.com/you-might-not-need-react-router-38673620f3d) by

### Related Projects

- [`path-to-regexp`](https://github.com/pillarjs/path-to-regexp)
- [`history`](https://github.com/ReactTraining/history)
- [Universal Router](https://github.com/kriasoft/universal-router)
